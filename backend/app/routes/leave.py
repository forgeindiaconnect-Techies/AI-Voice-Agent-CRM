from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from app.core.database import leave_requests_col, users_col, audit_logs_col
from app.core.utils import utcnow, oid_str
from app.core.deps import require_roles, get_current_user
from app.schemas.common import LeaveRequestCreate, LeaveDecision, Role
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/api/leave", tags=["leave"])


def _uid(user: dict) -> str:
    return user.get("id") or str(user["_id"])


@router.post("", dependencies=[Depends(require_roles(Role.AGENT))])
async def request_leave(payload: LeaveRequestCreate, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["agent_id"] = _uid(user)
    doc["status"] = "pending"
    doc["created_at"] = utcnow()
    result = await leave_requests_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    
    # Broadcast to notify supervisor
    await ws_manager.broadcast("global", {"event": "leave_requested", "agent_id": doc["agent_id"]})
    return oid_str(doc)


@router.get("", dependencies=[Depends(require_roles(Role.TEAM_LEADER, Role.ADMIN))])
async def list_leave_requests(status_filter: str | None = None, user: dict = Depends(get_current_user)):
    query = {}
    if status_filter:
        query["status"] = status_filter
        
    if user["role"] == Role.TEAM_LEADER:
        uid = _uid(user)
        assigned_agents = await users_col.find({"supervisor_id": uid, "role": Role.AGENT}).to_list(length=1000)
        agent_ids = [str(a["_id"]) for a in assigned_agents]
        query["agent_id"] = {"$in": agent_ids}
        
    items = []
    async for r in leave_requests_col.find(query).sort("created_at", -1):
        agent = await users_col.find_one({"_id": ObjectId(r.get("agent_id"))})
        r["agent_name"] = agent["name"] if agent else "Unknown Agent"
        items.append(oid_str(r))
    return items


@router.patch("/{request_id}/decision", dependencies=[Depends(require_roles(Role.TEAM_LEADER, Role.ADMIN))])
async def decide_leave(request_id: str, payload: LeaveDecision, user: dict = Depends(get_current_user)):
    req = await leave_requests_col.find_one({"_id": ObjectId(request_id)})
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave request not found")
        
    # Enforce supervisor access limits
    if user["role"] == Role.TEAM_LEADER:
        agent = await users_col.find_one({"_id": ObjectId(req["agent_id"])})
        if not agent or agent.get("supervisor_id") != _uid(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden: you can decide only your assigned team's leaves")
            
    new_status = "approved" if payload.approve else "rejected"
    await leave_requests_col.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {
            "status": new_status,
            "remarks": payload.remarks,
            "decided_by": _uid(user),
            "decided_at": utcnow()
        }},
    )
    
    # Audit log
    await audit_logs_col.insert_one({
        "action": f"decide_leave_{new_status}",
        "user_id": _uid(user),
        "target_user_id": req.get("agent_id"),
        "leave_request_id": request_id,
        "timestamp": utcnow()
    })
    
    # Notify agent automatically via WebSocket broadcast
    await ws_manager.broadcast("global", {
        "event": "leave_decided",
        "agent_id": req.get("agent_id"),
        "status": new_status,
        "remarks": payload.remarks
    })
    
    return {"status": new_status}
