import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from bson import ObjectId
from app.core.database import users_col, agent_shifts_col
from app.core.utils import utcnow, oid_str
from app.core.deps import get_current_user
from app.services.ws_manager import ws_manager

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/presence", tags=["presence"])


class StatusUpdateRequest(BaseModel):
    status: str = Field(..., description="Target status: ready, paused, in_call, or offline")
    pause_reason: Optional[str] = Field(None, description="Optional pause reason e.g. Lunch, Tea Break, Personal Reason")
    force_offline: Optional[bool] = Field(False, description="Force offline even if 8 hours incomplete")


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

    valid_statuses = {"ready", "paused", "in_call", "offline"}
    if new_status not in valid_statuses:
        logger.warning(f"[PRESENCE] Invalid status '{new_status}' requested for user {user_id}")
        return None

    query = {"_id": ObjectId(user_id)} if ObjectId.is_valid(user_id) else {"id": user_id}
    user = await users_col.find_one(query)
    if not user:
        logger.warning(f"[PRESENCE] User not found for ID {user_id}")
        return None

    current_status = user.get("status", "offline")
    existing_login = user.get("login_at")
    current_break = user.get("current_break")
    break_logs = list(user.get("break_logs") or [])

    # DEDUPLICATION: If requesting identical status and pause_reason, return existing data without mutating login_at
    if new_status == current_status:
        if new_status != "paused" or user.get("pause_reason") == pause_reason:
            logger.info(f"[PRESENCE DUP] Redundant status update '{new_status}' ignored for user {user_id}")
            # Calculate current working seconds
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
            work_sec = max(0, gross_sec - tot_break_sec)
            uid_str = str(user["_id"])
            return {
                "user_id": uid_str,
                "id": uid_str,
                "name": user.get("name"),
                "email": user.get("email"),
                "role": user.get("role"),
                "pool_id": user.get("pool_id"),
                "status": current_status,
                "pause_reason": user.get("pause_reason"),
                "login_at": existing_login,
                "logout_at": user.get("logout_at"),
                "current_break": current_break,
                "break_logs": break_logs,
                "total_break_seconds": tot_break_sec,
                "working_seconds": work_sec,
                "gross_seconds": gross_sec,
                "shift_target_reached": work_sec >= 28800,
                "last_status_change": user.get("last_status_change") or now_iso,
                "last_activity": now_iso,
                "timestamp": now_iso,
            }

    # MANAGE LOGIN / LOGOUT TIMESTAMPS
    login_val = existing_login
    logout_val = user.get("logout_at")

    if new_status in ("ready", "paused", "in_call"):
        if current_status == "offline" or not existing_login:
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

    # Net Working Hours = Current Time - Login Time - Total Break Duration
    working_seconds = max(0, gross_seconds - total_break_seconds)

    # STRICT 8-HOUR GO OFFLINE VALIDATION
    if new_status == "offline" and not force_offline:
        if working_seconds < 28800: # 8 Hours = 28,800 Seconds
            rem_sec = 28800 - working_seconds
            rem_m = Math.ceil(rem_sec / 60) if 'Math' in dir() else int(rem_sec // 60)
            logger.warning(f"[PRESENCE REJECT] User {user_id} attempted Go Offline with only {working_seconds}s worked out of 28800s")
            raise HTTPException(
                status_code=400,
                detail=f"Complete your 8-hour working period before going offline. (Completed: {int(working_seconds // 3600)}h {int((working_seconds % 3600) // 60)}m, Remaining: {int(rem_sec // 3600)}h {int((rem_sec % 3600) // 60)}m)"
            )

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

    total_ready = user.get("total_ready_seconds", 0) + (int((now - datetime.fromisoformat(user.get("last_status_change").replace("Z", "+00:00"))).total_seconds()) if current_status == "ready" and user.get("last_status_change") else 0)

    update_fields = {
        "status": new_status,
        "pause_reason": pause_reason if new_status == "paused" else None,
        "last_status_change": now_iso,
        "login_at": login_val,
        "logout_at": logout_val if new_status == "offline" else None,
        "current_break": current_break,
        "break_logs": break_logs,
        "total_break_seconds": total_break_seconds,
        "working_seconds": working_seconds,
        "gross_seconds": gross_seconds,
        "total_ready_seconds": total_ready,
        "break_stats": break_stats,
        "updated_at": now_iso,
    }

    await users_col.update_one(query, {"$set": update_fields})

    # Record shift log event in agent_shifts collection
    shift_date = now.strftime("%Y-%m-%d")
    uid_str = str(user["_id"])
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
    presence_payload = {
        "type": "agent_presence_updated",
        "data": {
            "user_id": uid_str,
            "id": uid_str,
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "pool_id": user.get("pool_id"),
            "status": new_status,
            "pause_reason": pause_reason if new_status == "paused" else None,
            "login_at": login_val,
            "logout_at": logout_val if new_status == "offline" else None,
            "current_break": current_break,
            "break_logs": break_logs,
            "total_break_seconds": total_break_seconds,
            "working_seconds": working_seconds,
            "gross_seconds": gross_seconds,
            "ready_seconds": total_ready,
            "break_stats": break_stats,
            "shift_target_reached": working_seconds >= 28800,
            "last_status_change": now_iso,
            "last_activity": now_iso,
            "timestamp": now_iso,
        }
    }

    try:
        await ws_manager.broadcast_global(presence_payload)
        logger.info(f"[PRESENCE WS BROADCAST] {user.get('name')} → status: '{new_status}' (Working: {working_seconds}s, Breaks: {total_break_seconds}s)")
    except Exception as e:
        logger.warning(f"[PRESENCE WS ERROR] Broadcast failed: {e}")

    return presence_payload["data"]


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

    async for u in cursor:
        uid = str(u["_id"])
        st = u.get("status", "offline")
        login_val = u.get("login_at")
        logout_val = u.get("logout_at")
        current_break = u.get("current_break")
        break_logs = list(u.get("break_logs") or [])

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

        work_sec = max(0, gross_sec - tot_break_sec)

        raw_stats = u.get("break_stats") or {}
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
            "pause_reason": u.get("pause_reason"),
            "login_at": login_val,
            "logout_at": logout_val,
            "current_break": current_break,
            "break_logs": break_logs,
            "total_break_seconds": tot_break_sec,
            "working_seconds": work_sec,
            "gross_seconds": gross_sec,
            "ready_seconds": u.get("total_ready_seconds", 0),
            "paused_seconds": u.get("total_paused_seconds", 0),
            "talk_seconds": u.get("talk_seconds", 0),
            "total_calls_handled": u.get("total_calls_handled", 0),
            "break_stats": break_stats,
            "shift_target_reached": work_sec >= 28800,
            "last_status_change": u.get("last_status_change"),
            "last_activity": u.get("last_status_change") or u.get("updated_at") or u.get("created_at"),
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
async def get_current_shift_summary(current_user: dict = Depends(get_current_user)):
    """Fetch live or completed shift telemetry summary for current user."""
    uid_str = str(current_user["_id"])
    now = utcnow()
    shift_date = now.strftime("%Y-%m-%d")

    user = await users_col.find_one({"_id": current_user["_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    shift_doc = await agent_shifts_col.find_one({"user_id": uid_str, "shift_date": shift_date})

    raw_stats = user.get("break_stats") or (shift_doc.get("break_stats") if shift_doc else {}) or {}
    break_stats = {
        "tea_break": {"count": raw_stats.get("tea_break", {}).get("count", 0), "total_seconds": raw_stats.get("tea_break", {}).get("total_seconds", 0)},
        "lunch_break": {"count": raw_stats.get("lunch_break", {}).get("count", 0), "total_seconds": raw_stats.get("lunch_break", {}).get("total_seconds", 0)},
        "personal_reason": {"count": raw_stats.get("personal_reason", {}).get("count", 0), "total_seconds": raw_stats.get("personal_reason", {}).get("total_seconds", 0)},
    }

    login_at = user.get("login_at") or (shift_doc.get("login_at") if shift_doc else None)
    logout_at = user.get("logout_at") or (shift_doc.get("logout_at") if shift_doc else None)
    st = user.get("status", "offline")
    current_break = user.get("current_break")
    break_logs = list(user.get("break_logs") or (shift_doc.get("break_logs") if shift_doc else []) or [])

    completed_break_sec = sum(int(b.get("duration_seconds", 0)) for b in break_logs)
    active_break_sec = 0
    if st == "paused" and current_break and current_break.get("start_time"):
        try:
            cb_start = datetime.fromisoformat(current_break["start_time"].replace("Z", "+00:00"))
            active_break_sec = max(0, int((now - cb_start).total_seconds()))
        except Exception:
            pass
    tot_break_sec = completed_break_sec + active_break_sec

    gross_seconds = 0
    if login_at:
        try:
            l_dt = datetime.fromisoformat(login_at.replace("Z", "+00:00"))
            ref_end = datetime.fromisoformat(logout_at.replace("Z", "+00:00")) if logout_at and st == "offline" else now
            gross_seconds = max(0, int((ref_end - l_dt).total_seconds()))
        except Exception:
            pass

    working_seconds = max(0, gross_seconds - tot_break_sec)
    talk_sec = user.get("talk_seconds", 0)
    calls_count = user.get("total_calls_handled", 0)

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
        "total_break_seconds": tot_break_sec,
        "working_seconds": working_seconds,
        "net_working_seconds": working_seconds,
        "ready_seconds": user.get("total_ready_seconds", 0),
        "paused_seconds": tot_break_sec,
        "talk_seconds": talk_sec,
        "total_calls_handled": calls_count,
        "avg_handling_seconds": int(talk_sec / calls_count) if calls_count > 0 else 0,
        "break_stats": break_stats,
        "target_seconds": 28800, # 8 hours
        "target_completed": working_seconds >= 28800,
        "completion_percentage": round(min(150, (working_seconds / 28800) * 100), 1),
    }

