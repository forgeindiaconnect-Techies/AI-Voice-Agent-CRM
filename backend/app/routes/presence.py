import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from bson import ObjectId
from app.core.database import users_col, agent_shifts_col, agent_presence_col, agent_status_history_col
from app.core.utils import utcnow, oid_str
from app.core.deps import get_current_user
from app.services.ws_manager import ws_manager

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/presence", tags=["presence"])
agent_router = APIRouter(prefix="/api/agent", tags=["agent-presence"])
agents_router = APIRouter(prefix="/api/agents", tags=["agents-status"])

# State machine allowed transition rules
ALLOWED_TRANSITIONS = {
    "offline": ["ready"],
    "ready": ["paused", "offline", "in_call"],
    "paused": ["ready", "offline"],
    "in_call": ["ready", "paused", "offline"]
}


def normalize_status_input(st: str) -> str:
    s = (st or "").strip().lower()
    if s in ("available", "ready"):
        return "ready"
    if s in ("on_break", "paused", "break"):
        return "paused"
    if s in ("offline", "logged_out"):
        return "offline"
    if s in ("in_call", "busy"):
        return "in_call"
    return s


def map_status_to_enum(st: str) -> str:
    s = (st or "").strip().lower()
    if s == "ready":
        return "AVAILABLE"
    if s == "paused":
        return "ON_BREAK"
    if s == "offline":
        return "OFFLINE"
    if s == "in_call":
        return "IN_CALL"
    return st.upper() if st else "OFFLINE"


def get_break_type_code(reason: Optional[str]) -> str:
    if not reason:
        return "PERSONAL"
    r = reason.strip().upper()
    if "LUNCH" in r:
        return "LUNCH"
    if "TEA" in r or "REFRESHMENT" in r:
        return "TEA"
    return "PERSONAL"


class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Target status: AVAILABLE, ON_BREAK, OFFLINE or ready, paused, offline")
    pause_reason: Optional[str] = Field(None, description="Optional pause reason e.g. Lunch, Tea Break, Personal Reason")
    break_type: Optional[str] = Field(None, description="Break type code: LUNCH, TEA, PERSONAL")
    force_offline: Optional[bool] = Field(False, description="Force offline even if 8 hours incomplete")


class PauseRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Break reason e.g. Lunch Break, Tea Break, Personal Reason")
    pause_reason: Optional[str] = Field(None, description="Break reason alias")
    break_type: Optional[str] = Field(None, description="Break type code e.g. LUNCH, TEA, PERSONAL")


class OfflineRequest(BaseModel):
    force_offline: Optional[bool] = Field(True, description="Confirmation flag for going offline")


def normalize_break_key(reason: Optional[str]) -> str:
    if not reason:
        return "personal_reason"
    r = reason.lower().strip()
    if "tea" in r:
        return "tea_break"
    if "lunch" in r:
        return "lunch_break"
    return "personal_reason"


async def record_presence_change(
    user_id: str,
    new_status: str,
    pause_reason: Optional[str] = None,
    source: str = "manual",
    force_offline: bool = False
) -> dict | None:
    """Core function to update user presence, persist shift state, and broadcast WebSocket events."""
    now = utcnow()
    now_iso = now.isoformat()

    new_status = normalize_status_input(new_status)

    valid_statuses = {"ready", "paused", "in_call", "offline"}
    if new_status not in valid_statuses:
        logger.warning(f"[PRESENCE] Invalid status '{new_status}' requested for user {user_id}")
        return None

    query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
    user = await users_col.find_one(query)
    if not user:
        logger.warning(f"[PRESENCE] User not found for ID {user_id}")
        return None

    shift_date = now.strftime("%Y-%m-%d")
    user_shift_date = user.get("shift_date")

    current_status = user.get("status", "offline")
    existing_login = user.get("login_at")
    current_break = user.get("current_break")
    break_logs = list(user.get("break_logs") or [])
    uid_str = str(user["_id"])

    # DAILY AUTO-RESET: If calendar date changed, start a fresh session state for today
    if user_shift_date != shift_date:
        existing_login = None
        current_break = None
        break_logs = []
        current_status = "offline"

    # REJECT INVALID SAME-STATE OR TRANSITION REQUESTS
    if current_status == "paused" and new_status == "paused" and user_shift_date == shift_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent is already on break (ON_BREAK -> ON_BREAK is invalid)."
        )

    if current_status == "offline" and new_status == "offline" and user_shift_date == shift_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent is already offline (OFFLINE -> OFFLINE is invalid)."
        )

    if current_status == "offline" and new_status == "paused":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transition directly from OFFLINE to ON_BREAK. Set status to AVAILABLE first."
        )

    if current_status in ("in_call", "calling") and new_status == "offline" and not force_offline:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot go offline while an active call is in progress. Please complete disposition first."
        )

    # DEDUPLICATION / IDEMPOTENCY: If requesting identical status (e.g. ready -> ready), return existing state
    if new_status == current_status and user_shift_date == shift_date:
        logger.info(f"[PRESENCE DUP] Redundant status update '{new_status}' ignored for user {user_id}")
        login_dt = datetime.fromisoformat(existing_login.replace("Z", "+00:00")) if existing_login else now
        gross_sec = max(0, int((now - login_dt).total_seconds())) if existing_login else 0
        comp_break_sec = sum(int(b.get("duration_seconds", 0)) for b in break_logs)
        act_break_sec = 0
        if current_status == "paused" and current_break and current_break.get("start_time"):
            try:
                cb_start = datetime.fromisoformat(current_break["start_time"].replace("Z", "+00:00"))
                act_break_sec = max(0, int((now - cb_start).total_seconds()))
            except Exception:
                pass
        tot_break_sec = comp_break_sec + act_break_sec
        ready_sec = max(0, gross_sec - tot_break_sec)
        return {
            "user_id": uid_str,
            "agentId": uid_str,
            "id": uid_str,
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "pool_id": user.get("pool_id"),
            "status": map_status_to_enum(current_status),
            "raw_status": current_status,
            "breakType": get_break_type_code(user.get("pause_reason")) if current_status == "paused" else None,
            "breakStartedAt": current_break.get("start_time") if current_break else None,
            "pause_reason": user.get("pause_reason"),
            "login_at": existing_login,
            "logout_at": user.get("logout_at"),
            "current_break": current_break,
            "break_logs": break_logs,
            "total_break_seconds": tot_break_sec,
            "working_seconds": ready_sec,
            "gross_seconds": gross_sec,
            "total_login_seconds": gross_sec,
            "total_ready_seconds": ready_sec,
            "total_pause_seconds": tot_break_sec,
            "required_seconds": 28800,
            "remaining_seconds": max(0, 28800 - gross_sec),
            "completed_8_hours": gross_sec >= 28800,
            "session_status": "COMPLETED" if gross_sec >= 28800 else "INCOMPLETE",
            "shift_target_reached": gross_sec >= 28800,
            "last_status_change": user.get("last_status_change") or now_iso,
            "status_since": user.get("last_status_change") or now_iso,
            "last_activity": now_iso,
            "timestamp": now_iso,
        }

    # STATE MACHINE TRANSITION VALIDATION
    allowed_next = ALLOWED_TRANSITIONS.get(current_status, ["ready", "paused", "offline"])
    if new_status not in allowed_next:
        logger.warning(f"[PRESENCE REJECT] Invalid transition '{current_status}' -> '{new_status}' for user {user_id}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{map_status_to_enum(current_status)}' to '{map_status_to_enum(new_status)}'."
        )

    # LOG BACKEND STATE TRANSITION FOR BPO AUDIT
    break_code = get_break_type_code(pause_reason) if new_status == "paused" else None
    session_id = f"session_{uid_str}_{shift_date}"
    logger.info(
        f"[PRESENCE TRANSITION] AgentId: {uid_str} | PreviousState: {map_status_to_enum(current_status)} ({current_status}) | "
        f"NewState: {map_status_to_enum(new_status)} ({new_status}) | BreakType: {break_code} | SessionId: {session_id} | Timestamp: {now_iso}"
    )

    # MANAGE LOGIN / LOGOUT TIMESTAMPS
    login_val = existing_login
    logout_val = user.get("logout_at")

    if new_status in ("ready", "paused", "in_call"):
        if current_status == "offline" or not existing_login or user_shift_date != shift_date:
            login_val = now_iso
            logout_val = None
        else:
            login_val = existing_login
    elif new_status == "offline":
        logout_val = now_iso


    # MANAGE BREAK LOGS AND CURRENT BREAK
    if current_status in ("paused", "break") and new_status != "paused":
        # Finalize active break
        b_start_str = (current_break.get("start_time") if isinstance(current_break, dict) else None) or user.get("last_status_change") or now_iso
        try:
            b_start_dt = datetime.fromisoformat(b_start_str.replace("Z", "+00:00"))
        except Exception:
            b_start_dt = now
        b_dur_sec = max(0, int((now - b_start_dt).total_seconds()))

        b_type = (current_break.get("type") if isinstance(current_break, dict) else None) or user.get("pause_reason") or "Personal Reason"

        completed_break = {
            "type": b_type,
            "start_time": b_start_str,
            "end_time": now_iso,
            "duration_seconds": b_dur_sec
        }
        break_logs.append(completed_break)
        current_break = None

    if new_status == "paused":
        if current_status != "paused" or not current_break:
            current_break = {
                "type": pause_reason or "Personal Reason",
                "start_time": now_iso
            }

    # CALCULATE BREAK DURATIONS AND WORKING HOURS
    completed_break_seconds = sum(int(b.get("duration_seconds", 0)) for b in break_logs)
    
    # ENFORCE MAX BREAK LIMIT (1 hr 3 mins = 3780 seconds)
    MAX_BREAK_LIMIT_SECONDS = 3780
    if new_status == "paused" and completed_break_seconds >= MAX_BREAK_LIMIT_SECONDS:
        logger.warning(f"[PRESENCE REJECT] User {user_id} exceeded max daily break limit ({completed_break_seconds}s / {MAX_BREAK_LIMIT_SECONDS}s)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum daily break limit of 1 hr 3 min reached. You cannot take any more breaks today."
        )

    active_break_seconds = 0
    if new_status == "paused" and current_break and current_break.get("start_time"):
        try:
            cb_start = datetime.fromisoformat(current_break["start_time"].replace("Z", "+00:00"))
            active_break_seconds = max(0, int((now - cb_start).total_seconds()))
        except Exception:
            pass

    total_break_seconds = completed_break_seconds + active_break_seconds

    # Gross shift duration = Now - login_at
    gross_seconds = 0
    if login_val:
        try:
            l_dt = datetime.fromisoformat(login_val.replace("Z", "+00:00"))
            gross_seconds = max(0, int((now - l_dt).total_seconds()))
        except Exception:
            gross_seconds = 0

    # ENFORCE MANDATORY 8-HOUR SHIFT BEFORE GOING OFFLINE (UNLESS FORCE_OFFLINE IS EXPLICIT)
    if new_status == "offline" and not force_offline and gross_seconds < 28800:
        logger.warning(f"[PRESENCE REJECT] User {user_id} attempted offline before 8-hour shift ({gross_seconds}s < 28800s)")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shift incomplete. You must complete 8 hours of login shift time (including breaks) before going offline."
        )

    # Net Working Hours = Current Time - Login Time - Total Break Duration
    working_seconds = max(0, gross_seconds - total_break_seconds)

    # Categorized stats summary
    raw_stats = user.get("break_stats") or {}
    break_stats = {
        "tea_break": {"count": 0, "total_seconds": 0},
        "lunch_break": {"count": 0, "total_seconds": 0},
        "personal_reason": {"count": 0, "total_seconds": 0},
    }
    for b in break_logs:
        b_key = normalize_break_key(b.get("type"))
        break_stats[b_key]["count"] += 1
        break_stats[b_key]["total_seconds"] += int(b.get("duration_seconds", 0))

    if new_status == "paused" and current_break:
        b_key = normalize_break_key(current_break.get("type"))
        break_stats[b_key]["count"] += 1
        break_stats[b_key]["total_seconds"] += active_break_seconds

    ready_sec = max(0, gross_seconds - total_break_seconds)
    completed_8_hours = gross_seconds >= 28800
    remaining_seconds = max(0, 28800 - gross_seconds)

    update_fields = {
        "status": new_status,
        "pause_reason": pause_reason if new_status == "paused" else None,
        "last_status_change": now_iso,
        "login_at": login_val,
        "logout_at": logout_val if new_status == "offline" else None,
        "current_break": current_break,
        "break_logs": break_logs,
        "total_break_seconds": total_break_seconds,
        "working_seconds": ready_sec,
        "gross_seconds": gross_seconds,
        "total_login_seconds": gross_seconds,
        "total_ready_seconds": ready_sec,
        "total_pause_seconds": total_break_seconds,
        "required_seconds": 28800,
        "completed_8_hours": completed_8_hours,
        "remaining_seconds": remaining_seconds,
        "session_status": "COMPLETED" if completed_8_hours else "INCOMPLETE",
        "shift_date": shift_date,
        "break_stats": break_stats,
        "updated_at": now_iso,
    }


    await users_col.update_one(query, {"$set": update_fields})


    # Record presence state in agent_presence collection
    presence_doc = {
        "id": uid_str,
        "agent_id": uid_str,
        "user_id": uid_str,
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "status": new_status,
        "break_reason": pause_reason if new_status == "paused" else None,
        "status_since": now_iso,
        "last_activity_at": now_iso,
        "session_id": f"session_{uid_str}_{shift_date}",
        "updated_at": now_iso
    }
    await agent_presence_col.update_one({"agent_id": uid_str}, {"$set": presence_doc}, upsert=True)

    # Record transition audit in agent_status_history collection
    prev_status_start = user.get("last_status_change") or login_val or now_iso
    dur_sec = 0
    try:
        p_dt = datetime.fromisoformat(prev_status_start.replace("Z", "+00:00"))
        dur_sec = max(0, int((now - p_dt).total_seconds()))
    except Exception:
        dur_sec = 0

    history_doc = {
        "agent_id": uid_str,
        "previous_status": current_status,
        "new_status": new_status,
        "break_reason": pause_reason if new_status == "paused" else None,
        "started_at": prev_status_start,
        "ended_at": now_iso,
        "duration_seconds": dur_sec,
        "session_id": f"session_{uid_str}_{shift_date}",
        "created_at": now_iso
    }
    await agent_status_history_col.insert_one(history_doc)

    # Record shift log event in agent_shifts collection
    shift_doc = await agent_shifts_col.find_one({"user_id": uid_str, "shift_date": shift_date})

    event_entry = {
        "status": new_status,
        "pause_reason": pause_reason,
        "timestamp": now_iso,
        "source": source,
    }

    if not shift_doc:
        await agent_shifts_col.insert_one({
            "user_id": uid_str,
            "user_name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "pool_id": user.get("pool_id"),
            "shift_date": shift_date,
            "login_at": login_val,
            "logout_at": logout_val if new_status == "offline" else None,
            "events": [event_entry],
            "break_logs": break_logs,
            "total_break_seconds": total_break_seconds,
            "working_seconds": working_seconds,
            "gross_seconds": gross_seconds,
            "break_stats": break_stats,
            "created_at": now_iso,
            "updated_at": now_iso,
        })
    else:
        shift_update = {
            "$push": {"events": event_entry},
            "$set": {
                "login_at": login_val,
                "break_logs": break_logs,
                "total_break_seconds": total_break_seconds,
                "working_seconds": working_seconds,
                "gross_seconds": gross_seconds,
                "break_stats": break_stats,
                "updated_at": now_iso,
            }
        }
        if new_status == "offline":
            shift_update["$set"]["logout_at"] = logout_val

        await agent_shifts_col.update_one({"_id": shift_doc["_id"]}, shift_update)

    # Broadcast real-time WebSocket event globally across all dashboards
    data_payload = {
        "user_id": uid_str,
        "id": uid_str,
        "name": user.get("name"),
        "email": user.get("email"),
        "role": user.get("role"),
        "pool_id": user.get("pool_id"),
        "status": map_status_to_enum(new_status),
        "raw_status": new_status,
        "breakType": get_break_type_code(pause_reason) if new_status == "paused" else None,
        "pause_reason": pause_reason if new_status == "paused" else None,
        "login_at": login_val,
        "logout_at": logout_val if new_status == "offline" else None,
        "current_break": current_break,
        "break_logs": break_logs,
        "total_break_seconds": total_break_seconds,
        "working_seconds": ready_sec,
        "gross_seconds": gross_seconds,
        "total_login_seconds": gross_seconds,
        "total_ready_seconds": ready_sec,
        "total_pause_seconds": total_break_seconds,
        "ready_seconds": ready_sec,
        "break_stats": break_stats,
        "required_seconds": 28800,
        "remaining_seconds": remaining_seconds,
        "shift_target_reached": gross_seconds >= 28800,
        "completed_8_hours": gross_seconds >= 28800,
        "eightHourCompleted": gross_seconds >= 28800,
        "session_status": "COMPLETED" if gross_seconds >= 28800 else "INCOMPLETE",

        "last_status_change": now_iso,
        "status_since": now_iso,
        "last_activity": now_iso,
        "timestamp": now_iso,
    }



    presence_payload = {
        "event": "agent.status.changed",
        "type": "agent_presence_updated",
        "agentId": uid_str,
        "user_id": uid_str,
        "previousStatus": current_status,
        "status": new_status,
        "reason": pause_reason if new_status == "paused" else None,
        "statusSince": now_iso,
        "timestamp": now_iso,
        "data": data_payload
    }

    try:
        await ws_manager.broadcast_global(presence_payload)
        logger.info(f"[PRESENCE WS BROADCAST] {user.get('name')} → status: '{new_status}' (Working: {working_seconds}s, Breaks: {total_break_seconds}s)")
    except Exception as e:
        logger.warning(f"[PRESENCE WS ERROR] Broadcast failed: {e}")

    return data_payload



async def record_call_completion(
    user_id: str,
    duration_seconds: int = 0,
    call_id: Optional[str] = None,
    outcome: str = "completed"
) -> dict | None:
    """Idempotently records completed call, increments total_calls_handled & talk_seconds in MongoDB, and emits WebSocket broadcast."""
    now = utcnow()
    now_iso = now.isoformat()
    shift_date = now.strftime("%Y-%m-%d")

    uid_str = str(user_id)
    query = {"_id": ObjectId(uid_str)} if ObjectId.is_valid(uid_str) else {"id": uid_str}

    # Increment total_calls_handled and talk_seconds in users collection
    await users_col.update_one(
        query,
        {
            "$inc": {
                "total_calls_handled": 1,
                "talk_seconds": duration_seconds
            },
            "$set": {"updated_at": now_iso}
        }
    )

    # Increment total_calls_handled and talk_seconds in agent_shifts collection
    await agent_shifts_col.update_one(
        {"user_id": uid_str, "shift_date": shift_date},
        {
            "$inc": {
                "total_calls_handled": 1,
                "talk_seconds": duration_seconds
            },
            "$set": {"updated_at": now_iso}
        }
    )

    # Fetch updated user doc
    updated_user = await users_col.find_one(query)
    if not updated_user:
        return None

    new_total_calls = updated_user.get("total_calls_handled", 1)

    # Broadcast WSS payload to all dashboards globally
    payload = {
        "type": "call_completed",
        "data": {
            "user_id": uid_str,
            "agent_id": uid_str,
            "call_id": call_id or "session_completed",
            "duration_seconds": duration_seconds,
            "outcome": outcome,
            "total_calls_handled": new_total_calls,
            "talk_seconds": updated_user.get("talk_seconds", 0),
            "timestamp": now_iso
        }
    }

    try:
        await ws_manager.broadcast_global(payload)
        logger.info(f"[CALL COMPLETED WS BROADCAST] Agent {uid_str} → Total Calls: {new_total_calls}")
    except Exception as e:
        logger.warning(f"[CALL COMPLETED WS ERROR] Broadcast failed: {e}")

    return payload["data"]


@router.post("/status")
@router.post("/status-update")
@router.post("/update")
async def update_status(payload: StatusUpdateRequest, current_user: dict = Depends(get_current_user)):
    """Update current agent status (Ready, Paused, Offline) and broadcast to all dashboards."""
    uid = str(current_user["_id"])
    target_status = payload.status.lower().strip()
    result = await record_presence_change(
        user_id=uid,
        new_status=target_status,
        pause_reason=payload.pause_reason,
        source="user_action",
        force_offline=bool(payload.force_offline)
    )
    if not result:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Failed to update presence status")
    return {"status": "success", "presence": result}


@router.get("/agents")
async def get_agents_presence(current_user: dict = Depends(get_current_user)):
    """Fetch live presence details for all agents/users for TL and Admin dashboards."""
    role = current_user.get("role")
    pool_id = current_user.get("pool_id")

    query = {}
    if role == "team_leader" and pool_id:
        query["$or"] = [{"pool_id": pool_id}, {"role": "agent"}]
    elif role == "agent":
        query["_id"] = current_user["_id"]

    cursor = users_col.find(query, {"password": 0})
    agents = []
    now = utcnow()

    today_str = now.strftime("%Y-%m-%d")

    async for u in cursor:
        uid = str(u["_id"])
        is_today = (u.get("shift_date") == today_str)

        st = u.get("status", "offline") if is_today else "offline"
        login_val = u.get("login_at") if is_today else None
        logout_val = u.get("logout_at") if is_today else None
        current_break = u.get("current_break") if is_today else None
        break_logs = list(u.get("break_logs") or []) if is_today else []

        completed_break_sec = sum(int(b.get("duration_seconds", 0)) for b in break_logs)
        active_break_sec = 0
        if st == "paused" and current_break and current_break.get("start_time"):
            try:
                cb_start = datetime.fromisoformat(current_break["start_time"].replace("Z", "+00:00"))
                active_break_sec = max(0, int((now - cb_start).total_seconds()))
            except Exception:
                pass
        tot_break_sec = completed_break_sec + active_break_sec

        gross_sec = 0
        if login_val:
            try:
                l_dt = datetime.fromisoformat(login_val.replace("Z", "+00:00"))
                ref_end = datetime.fromisoformat(logout_val.replace("Z", "+00:00")) if logout_val and st == "offline" else now
                gross_sec = max(0, int((ref_end - l_dt).total_seconds()))
            except Exception:
                pass

        ready_sec = max(0, gross_sec - tot_break_sec)

        raw_stats = (u.get("break_stats") if is_today else None) or {}
        break_stats = {
            "tea_break": {"count": raw_stats.get("tea_break", {}).get("count", 0), "total_seconds": raw_stats.get("tea_break", {}).get("total_seconds", 0)},
            "lunch_break": {"count": raw_stats.get("lunch_break", {}).get("count", 0), "total_seconds": raw_stats.get("lunch_break", {}).get("total_seconds", 0)},
            "personal_reason": {"count": raw_stats.get("personal_reason", {}).get("count", 0), "total_seconds": raw_stats.get("personal_reason", {}).get("total_seconds", 0)},
        }

        agents.append({
            "id": uid,
            "user_id": uid,
            "name": u.get("name", "Unknown Agent"),
            "email": u.get("email"),
            "role": u.get("role", "agent"),
            "employee_id": u.get("employee_id"),
            "pool_id": u.get("pool_id"),
            "status": st,
            "pause_reason": u.get("pause_reason") if is_today else None,
            "login_at": login_val,
            "logout_at": logout_val,
            "current_break": current_break,
            "break_logs": break_logs,
            "total_break_seconds": tot_break_sec,
            "working_seconds": ready_sec,
            "gross_seconds": gross_sec,
            "total_login_seconds": gross_sec,
            "total_ready_seconds": ready_sec,
            "total_pause_seconds": tot_break_sec,
            "ready_seconds": ready_sec,
            "paused_seconds": tot_break_sec,
            "talk_seconds": u.get("talk_seconds", 0) if is_today else 0,
            "total_calls_handled": u.get("total_calls_handled", 0) if is_today else 0,
            "break_stats": break_stats,
            "shift_target_reached": gross_sec >= 28800,
            "completed_8_hours": gross_sec >= 28800,
            "remaining_seconds": max(0, 28800 - gross_sec),
            "last_status_change": u.get("last_status_change") if is_today else None,
            "last_activity": u.get("last_status_change") if is_today else u.get("updated_at") or u.get("created_at"),
            "is_active": u.get("is_active", True)
        })

    return agents



@router.get("/summary")
async def get_presence_summary(current_user: dict = Depends(get_current_user)):
    """Fetch aggregate presence counts for top dashboard summary cards."""
    total_agents = await users_col.count_documents({"role": "agent"})
    ready_count = await users_col.count_documents({"role": "agent", "status": "ready"})
    paused_count = await users_col.count_documents({"role": "agent", "status": "paused"})
    in_call_count = await users_col.count_documents({"role": "agent", "status": "in_call"})
    offline_count = await users_col.count_documents({
        "role": "agent",
        "$or": [{"status": "offline"}, {"status": {"$exists": False}}]
    })
    online_count = ready_count + paused_count + in_call_count

    return {
        "total_agents": total_agents,
        "online_count": online_count,
        "ready_count": ready_count,
        "paused_count": paused_count,
        "in_call_count": in_call_count,
        "offline_count": offline_count,
    }


@router.get("/shifts")
async def get_shift_history(current_user: dict = Depends(get_current_user)):
    """Fetch shift history logs for reporting."""
    uid = str(current_user["_id"])
    role = current_user.get("role")

    query = {}
    if role == "agent":
        query["user_id"] = uid

    shifts = []
    cursor = agent_shifts_col.find(query).sort("created_at", -1).limit(50)
    async for doc in cursor:
        shifts.append(oid_str(doc))
    return shifts


@router.get("/shift-summary")
async def get_current_shift_summary(
    date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Fetch live or completed shift telemetry summary for current user for today or a specific date."""
    uid_str = str(current_user["_id"])
    now = utcnow()
    today_str = now.strftime("%Y-%m-%d")
    shift_date = date or today_str

    user = await users_col.find_one({"_id": current_user["_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    shift_doc = await agent_shifts_col.find_one({"user_id": uid_str, "shift_date": shift_date})
    is_today = (shift_date == today_str)

    raw_stats = (user.get("break_stats") if is_today else None) or (shift_doc.get("break_stats") if shift_doc else {}) or {}
    break_stats = {
        "tea_break": {"count": raw_stats.get("tea_break", {}).get("count", 0), "total_seconds": raw_stats.get("tea_break", {}).get("total_seconds", 0)},
        "lunch_break": {"count": raw_stats.get("lunch_break", {}).get("count", 0), "total_seconds": raw_stats.get("lunch_break", {}).get("total_seconds", 0)},
        "personal_reason": {"count": raw_stats.get("personal_reason", {}).get("count", 0), "total_seconds": raw_stats.get("personal_reason", {}).get("total_seconds", 0)},
    }

    login_at = (user.get("login_at") if is_today else None) or (shift_doc.get("login_at") if shift_doc else None)
    logout_at = (user.get("logout_at") if is_today else None) or (shift_doc.get("logout_at") if shift_doc else None)
    st = (user.get("status") if is_today else "offline")
    current_break = user.get("current_break") if is_today else None
    break_logs = list((user.get("break_logs") if is_today else None) or (shift_doc.get("break_logs") if shift_doc else []) or [])

    completed_break_sec = sum(int(b.get("duration_seconds", 0)) for b in break_logs)
    active_break_sec = 0
    if is_today and st == "paused" and current_break and current_break.get("start_time"):
        try:
            cb_start = datetime.fromisoformat(current_break["start_time"].replace("Z", "+00:00"))
            active_break_sec = max(0, int((now - cb_start).total_seconds()))
        except Exception:
            pass
    tot_break_sec = (shift_doc.get("total_break_seconds") if not is_today and shift_doc else None) or (completed_break_sec + active_break_sec)

    gross_seconds = 0
    if login_at:
        try:
            l_dt = datetime.fromisoformat(login_at.replace("Z", "+00:00"))
            ref_end = datetime.fromisoformat(logout_at.replace("Z", "+00:00")) if logout_at else (now if is_today else l_dt)
            gross_seconds = max(0, int((ref_end - l_dt).total_seconds()))
        except Exception:
            pass

    if not is_today and shift_doc and shift_doc.get("gross_seconds"):
        gross_seconds = shift_doc["gross_seconds"]


    ready_sec = max(0, gross_seconds - tot_break_sec)
    completed_8_hours = gross_seconds >= 28800
    remaining_sec = max(0, 28800 - gross_seconds)

    return {
        "user_id": uid_str,
        "name": user.get("name"),
        "email": user.get("email"),
        "shift_date": shift_date,
        "status": st,
        "pause_reason": user.get("pause_reason"),
        "login_at": login_at,
        "logout_at": logout_at,
        "current_break": current_break,
        "break_logs": break_logs,
        "gross_seconds": gross_seconds,
        "total_login_seconds": gross_seconds,
        "total_ready_seconds": ready_sec,
        "total_pause_seconds": tot_break_sec,
        "working_seconds": ready_sec,
        "net_working_seconds": ready_sec,
        "ready_seconds": ready_sec,
        "paused_seconds": tot_break_sec,
        "talk_seconds": talk_sec,
        "total_calls_handled": calls_count,
        "avg_handling_seconds": int(talk_sec / calls_count) if calls_count > 0 else 0,
        "break_stats": break_stats,
        "required_seconds": 28800,
        "target_seconds": 28800,
        "completed_8_hours": completed_8_hours,
        "target_completed": completed_8_hours,
        "remaining_seconds": remaining_sec,
        "session_status": "COMPLETED" if completed_8_hours else "INCOMPLETE",
        "completion_percentage": round(min(150, (gross_seconds / 28800) * 100), 1),
    }



# ── Additional Agent Presence API Endpoints ─────────────────────────────────────

@router.get("/me")
async def get_my_presence_endpoint(current_user: dict = Depends(get_current_user)):
    """Fetch current authoritative presence state for authenticated agent."""
    uid = str(current_user["_id"])
    query = {"_id": ObjectId(uid)} if ObjectId.is_valid(uid) else {"id": uid}
    user = await users_col.find_one(query)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = utcnow()
    now_iso = now.isoformat()
    today_str = now.strftime("%Y-%m-%d")

    user_shift_date = user.get("shift_date")
    is_today = (user_shift_date == today_str)

    st = user.get("status", "offline") if is_today else "offline"
    login_val = user.get("login_at") if is_today else None
    logout_val = user.get("logout_at") if is_today else None
    current_break = user.get("current_break") if is_today else None
    break_logs = list(user.get("break_logs") or []) if is_today else []

    completed_break_sec = sum(int(b.get("duration_seconds", 0)) for b in break_logs)
    active_break_sec = 0
    if st == "paused" and current_break and current_break.get("start_time"):
        try:
            cb_start = datetime.fromisoformat(current_break["start_time"].replace("Z", "+00:00"))
            active_break_sec = max(0, int((now - cb_start).total_seconds()))
        except Exception:
            pass
    tot_break_sec = completed_break_sec + active_break_sec

    gross_sec = 0
    if login_val:
        try:
            l_dt = datetime.fromisoformat(login_val.replace("Z", "+00:00"))
            ref_end = datetime.fromisoformat(logout_val.replace("Z", "+00:00")) if logout_val and st == "offline" else now
            gross_sec = max(0, int((ref_end - l_dt).total_seconds()))
        except Exception:
            pass

    ready_sec = max(0, gross_sec - tot_break_sec)
    eight_completed = gross_sec >= 28800

    return {
        "success": True,
        "agentId": uid,
        "user_id": uid,
        "status": st.upper(),
        "businessDate": today_str,
        "loginTime": login_val,
        "logoutTime": logout_val,
        "readySeconds": ready_sec,
        "pauseSeconds": tot_break_sec,
        "loginSeconds": gross_sec,
        "remainingSeconds": max(0, 28800 - gross_sec),
        "eightHourCompleted": eight_completed,

        # Standard fields for backward compatibility
        "pause_reason": user.get("pause_reason") if is_today else None,
        "statusSince": user.get("last_status_change") if is_today else now_iso,
        "last_status_change": user.get("last_status_change") if is_today else now_iso,
        "serverTime": now_iso,
        "login_at": login_val,
        "logout_at": logout_val,
        "current_break": current_break,
        "break_logs": break_logs,
        "working_seconds": ready_sec,
        "gross_seconds": gross_sec,
        "total_login_seconds": gross_sec,
        "total_ready_seconds": ready_sec,
        "total_pause_seconds": tot_break_sec,
        "ready_seconds": ready_sec,
        "paused_seconds": tot_break_sec,
        "talk_seconds": user.get("talk_seconds", 0) if is_today else 0,
        "total_calls_handled": user.get("total_calls_handled", 0) if is_today else 0,
        "completed_8_hours": eight_completed,
    }


@agent_router.get("/presence")
async def get_agent_presence_alias(current_user: dict = Depends(get_current_user)):
    """Alias route for GET /api/agent/presence."""
    return await get_my_presence_endpoint(current_user)




@agent_router.post("/presence/ready")
@agent_router.post("/presence/resume")
@agent_router.post("/status/ready")
@agent_router.post("/status/resume")
async def set_agent_ready_endpoint(current_user: dict = Depends(get_current_user)):
    """Set agent status to READY."""
    uid = str(current_user["_id"])
    result = await record_presence_change(user_id=uid, new_status="ready", source="user_action")
    return {
        "success": True,
        "agentId": uid,
        "status": "READY",
        "statusSince": result.get("last_status_change") if result else None,
        "presence": result
    }



@agent_router.post("/presence/pause")
@agent_router.post("/status/pause")
async def set_agent_pause_endpoint(payload: PauseRequest, current_user: dict = Depends(get_current_user)):
    """Set agent status to PAUSED with break reason."""
    uid = str(current_user["_id"])
    reason = payload.pause_reason or payload.reason or "Personal Reason"
    result = await record_presence_change(user_id=uid, new_status="paused", pause_reason=reason, source="user_action")
    return {
        "success": True,
        "agentId": uid,
        "status": "PAUSED",
        "reason": reason,
        "statusSince": result.get("last_status_change") if result else None,
        "presence": result
    }


@agent_router.post("/presence/offline")
@agent_router.post("/status/offline")
async def set_agent_offline_endpoint(payload: Optional[OfflineRequest] = None, current_user: dict = Depends(get_current_user)):
    """Set agent status to OFFLINE."""
    uid = str(current_user["_id"])
    force = payload.force_offline if payload else True
    result = await record_presence_change(user_id=uid, new_status="offline", force_offline=force, source="user_action")
    return {
        "success": True,
        "agentId": uid,
        "status": "OFFLINE",
        "statusSince": result.get("last_status_change") if result else None,
        "presence": result
    }



@router.get("/history")
@agent_router.get("/status-history")
async def get_status_history_endpoint(current_user: dict = Depends(get_current_user)):
    """Fetch status transition history records."""
    uid = str(current_user["_id"])
    role = current_user.get("role")

    query = {}
    if role == "agent":
        query["agent_id"] = uid

    logs = []
    cursor = agent_status_history_col.find(query).sort("created_at", -1).limit(100)
    async for doc in cursor:
        logs.append(oid_str(doc))
    return logs


# ── BPO Agent Session Management Endpoints (/api/agent/session/* & /agent/session/*) ─────────

session_router = APIRouter(prefix="/api/agent/session", tags=["agent-session"])
root_session_router = APIRouter(prefix="/agent/session", tags=["agent-session-root"])


class SessionBreakPayload(BaseModel):
    break_type: Optional[str] = Field(None, description="Break type code: LUNCH, TEA, PERSONAL")
    reason: Optional[str] = Field(None, description="Break reason string")

class SessionLogoutPayload(BaseModel):
    force_offline: Optional[bool] = Field(True, description="Confirmation flag for going offline")


async def handle_session_start(current_user: dict):
    uid_str = str(current_user["_id"])
    res = await record_presence_change(user_id=uid_str, new_status="ready", source="session_start")
    if not res:
        raise HTTPException(status_code=400, detail="Failed to start agent session")
    
    now_iso = res.get("login_at") or utcnow().isoformat()
    today_str = res.get("shift_date") or utcnow().strftime("%Y-%m-%d")

    return {
        "success": True,
        "agentId": uid_str,
        "sessionDate": today_str,
        "status": "READY",
        "raw_status": "ready",
        "loginTime": now_iso,
        "logoutTime": None,
        "totalWorkingSeconds": res.get("working_seconds", 0),
        "totalBreakSeconds": res.get("total_break_seconds", 0),
        "presence": res
    }


async def handle_session_break(payload: Optional[SessionBreakPayload], current_user: dict):
    uid_str = str(current_user["_id"])
    reason = payload.break_type if payload and payload.break_type else (payload.reason if payload else "Personal Break")

    if reason:
        r_upper = reason.strip().upper()
        if r_upper == "LUNCH":
            reason = "Lunch Break"
        elif r_upper == "TEA":
            reason = "Tea Break"
        elif r_upper == "PERSONAL":
            reason = "Personal Break"

    res = await record_presence_change(user_id=uid_str, new_status="paused", pause_reason=reason, source="session_break")
    if not res:
        raise HTTPException(status_code=400, detail="Failed to start break")

    b_type = get_break_type_code(reason)
    b_start = res.get("current_break", {}).get("start_time") if isinstance(res.get("current_break"), dict) else None

    return {
        "success": True,
        "agentId": uid_str,
        "status": "BREAK",
        "raw_status": "paused",
        "breakType": b_type,
        "breakStart": b_start,
        "presence": res
    }


async def handle_session_resume(current_user: dict):
    uid_str = str(current_user["_id"])
    res = await record_presence_change(user_id=uid_str, new_status="ready", source="session_resume")
    if not res:
        raise HTTPException(status_code=400, detail="Failed to resume work")

    return {
        "success": True,
        "agentId": uid_str,
        "status": "READY",
        "raw_status": "ready",
        "breakType": None,
        "breakStart": None,
        "breakEnd": res.get("last_status_change"),
        "presence": res
    }


async def handle_session_logout(payload: Optional[SessionLogoutPayload], current_user: dict):
    uid_str = str(current_user["_id"])
    force = payload.force_offline if payload else True
    res = await record_presence_change(user_id=uid_str, new_status="offline", force_offline=force, source="session_logout")
    if not res:
        raise HTTPException(status_code=400, detail="Failed to logout session")

    return {
        "success": True,
        "agentId": uid_str,
        "status": "OFFLINE",
        "raw_status": "offline",
        "logoutTime": res.get("logout_at"),
        "totalWorkingSeconds": res.get("working_seconds", 0),
        "totalBreakSeconds": res.get("total_break_seconds", 0),
        "totalLoginSeconds": res.get("total_login_seconds", 0),
        "callsMade": res.get("calls_made", 0),
        "connectedCalls": res.get("connected_calls", 0),
        "totalCallSeconds": res.get("talk_seconds", 0),
        "presence": res
    }


async def handle_get_active_session(current_user: dict):
    uid_str = str(current_user["_id"])
    user = await users_col.find_one({"_id": ObjectId(uid_str)})
    if not user:
        raise HTTPException(status_code=404, detail="Agent user not found")

    now = utcnow()
    now_iso = now.isoformat()
    today_str = now.strftime("%Y-%m-%d")
    is_today = (user.get("shift_date") == today_str)

    raw_st = user.get("status", "offline") if is_today else "offline"
    normalized_st = normalize_status_input(raw_st)
    
    if normalized_st == "ready":
        display_st = "READY"
    elif normalized_st == "paused":
        display_st = "BREAK"
    elif normalized_st == "in_call":
        display_st = "IN_CALL"
    else:
        display_st = "OFFLINE"

    current_break = user.get("current_break") if is_today else None
    break_logs = list(user.get("break_logs") or []) if is_today else []

    break_type = get_break_type_code(current_break.get("type") if isinstance(current_break, dict) else user.get("pause_reason")) if normalized_st == "paused" else None
    break_start = current_break.get("start_time") if isinstance(current_break, dict) else None

    # Fetch daily call metrics from shift or call logs
    shift_doc = await agent_shifts_col.find_one({"user_id": uid_str, "shift_date": today_str}) if is_today else None

    return {
        "agentId": uid_str,
        "sessionDate": today_str if is_today else today_str,
        "status": display_st,
        "raw_status": normalized_st,
        "loginTime": user.get("login_at") if is_today else None,
        "logoutTime": user.get("logout_at") if is_today else None,
        "breakType": break_type,
        "breakStart": break_start,
        "currentBreak": current_break,
        "breakLogs": break_logs,
        "totalWorkingSeconds": shift_doc.get("working_seconds", 0) if shift_doc else 0,
        "totalBreakSeconds": shift_doc.get("total_break_seconds", 0) if shift_doc else 0,
        "callsMade": shift_doc.get("calls_made", 0) if shift_doc else 0,
        "connectedCalls": shift_doc.get("connected_calls", 0) if shift_doc else 0,
        "totalCallSeconds": shift_doc.get("talk_seconds", 0) if shift_doc else 0,
        "timestamp": now_iso
    }


# Route Registrations for /api/agent/session
@session_router.post("/start")
async def api_session_start(current_user: dict = Depends(get_current_user)):
    return await handle_session_start(current_user)

@session_router.post("/break")
async def api_session_break(payload: Optional[SessionBreakPayload] = None, current_user: dict = Depends(get_current_user)):
    return await handle_session_break(payload, current_user)

@session_router.post("/resume")
async def api_session_resume(current_user: dict = Depends(get_current_user)):
    return await handle_session_resume(current_user)

@session_router.post("/logout")
async def api_session_logout(payload: Optional[SessionLogoutPayload] = None, current_user: dict = Depends(get_current_user)):
    return await handle_session_logout(payload, current_user)

@session_router.get("/active")
async def api_session_active(current_user: dict = Depends(get_current_user)):
    return await handle_get_active_session(current_user)

@session_router.get("/today")
async def api_session_today(current_user: dict = Depends(get_current_user)):
    return await handle_get_active_session(current_user)


# Route Registrations for /agent/session (root fallback)
@root_session_router.post("/start")
async def root_session_start(current_user: dict = Depends(get_current_user)):
    return await handle_session_start(current_user)

@root_session_router.post("/break")
async def root_session_break(payload: Optional[SessionBreakPayload] = None, current_user: dict = Depends(get_current_user)):
    return await handle_session_break(payload, current_user)

@root_session_router.post("/resume")
async def root_session_resume(current_user: dict = Depends(get_current_user)):
    return await handle_session_resume(current_user)

@root_session_router.post("/logout")
async def root_session_logout(payload: Optional[SessionLogoutPayload] = None, current_user: dict = Depends(get_current_user)):
    return await handle_session_logout(payload, current_user)

@root_session_router.get("/active")
async def root_session_active(current_user: dict = Depends(get_current_user)):
    return await handle_get_active_session(current_user)

@root_session_router.get("/today")
async def root_session_today(current_user: dict = Depends(get_current_user)):
    return await handle_get_active_session(current_user)




