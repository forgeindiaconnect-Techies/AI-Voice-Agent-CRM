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
    pause_reason: Optional[str] = Field(None, description="Optional pause reason e.g. Lunch, Tea Break, Training")


async def record_presence_change(
    user_id: str,
    new_status: str,
    pause_reason: Optional[str] = None,
    source: str = "manual"
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
    last_change = user.get("last_status_change") or user.get("created_at")

    # Parse last_status_change if present
    last_dt = now
    if last_change:
        if isinstance(last_change, str):
            try:
                last_dt = datetime.fromisoformat(last_change.replace("Z", "+00:00"))
            except Exception:
                last_dt = now
        elif isinstance(last_change, datetime):
            last_dt = last_change

    elapsed_seconds = int(max(0, (now - last_dt).total_seconds()))

    total_ready = user.get("total_ready_seconds", 0)
    total_paused = user.get("total_paused_seconds", 0)

    # Accumulate previous state durations
    if current_status in ("ready", "online"):
        total_ready += elapsed_seconds
    elif current_status in ("paused", "break"):
        total_paused += elapsed_seconds

    update_fields = {
        "status": new_status,
        "last_status_change": now_iso,
        "total_ready_seconds": total_ready,
        "total_paused_seconds": total_paused,
        "updated_at": now_iso,
    }

    if pause_reason is not None:
        update_fields["pause_reason"] = pause_reason

    # Manage Login / Logout timestamps
    existing_login = user.get("login_at")
    if new_status in ("ready", "paused", "in_call"):
        if not existing_login or current_status == "offline":
            update_fields["login_at"] = now_iso
            update_fields["logout_at"] = None
        else:
            update_fields["login_at"] = existing_login
    elif new_status == "offline":
        update_fields["logout_at"] = now_iso

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

    login_val = update_fields.get("login_at") or user.get("login_at") or now_iso
    logout_val = update_fields.get("logout_at") if new_status == "offline" else None

    if not shift_doc:
        await agent_shifts_col.insert_one({
            "user_id": uid_str,
            "user_name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "pool_id": user.get("pool_id"),
            "shift_date": shift_date,
            "login_at": login_val,
            "logout_at": logout_val,
            "events": [event_entry],
            "total_ready_seconds": total_ready,
            "total_paused_seconds": total_paused,
            "created_at": now_iso,
            "updated_at": now_iso,
        })
    else:
        shift_update = {
            "$push": {"events": event_entry},
            "$set": {
                "total_ready_seconds": total_ready,
                "total_paused_seconds": total_paused,
                "updated_at": now_iso,
            }
        }
        if new_status == "offline":
            shift_update["$set"]["logout_at"] = now_iso
        elif not shift_doc.get("login_at"):
            shift_update["$set"]["login_at"] = login_val

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
            "pause_reason": pause_reason,
            "login_at": login_val,
            "logout_at": logout_val,
            "ready_seconds": total_ready,
            "paused_seconds": total_paused,
            "last_status_change": now_iso,
            "last_activity": now_iso,
            "timestamp": now_iso,
        }
    }

    try:
        await ws_manager.broadcast_global(presence_payload)
        logger.info(f"[PRESENCE WS BROADCAST] {user.get('name')} → status: '{new_status}'")
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
        source="user_action"
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
        last_change = u.get("last_status_change") or u.get("created_at") or now

        if isinstance(last_change, str):
            try:
                last_dt = datetime.fromisoformat(last_change.replace("Z", "+00:00"))
            except Exception:
                last_dt = now
        else:
            last_dt = last_change or now

        elapsed = int(max(0, (now - last_dt).total_seconds()))
        ready_sec = u.get("total_ready_seconds", 0) + (elapsed if st == "ready" else 0)
        paused_sec = u.get("total_paused_seconds", 0) + (elapsed if st == "paused" else 0)

        login_val = u.get("login_at")
        if not login_val and st != "offline":
            login_val = (u.get("last_status_change") or u.get("created_at") or now_iso)
            if isinstance(login_val, datetime):
                login_val = login_val.isoformat()

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
            "logout_at": u.get("logout_at"),
            "ready_seconds": ready_sec,
            "paused_seconds": paused_sec,
            "talk_seconds": u.get("talk_seconds", 0),
            "total_calls_handled": u.get("total_calls_handled", 0),
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
