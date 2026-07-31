from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from app.core.database import users_col, supervisors_col, agents_col, audit_logs_col, pool_transfers_col, pools_col
from app.core.security import hash_password
from app.core.utils import gen_employee_id, utcnow, oid_str
from app.core.deps import require_roles, get_current_user
from app.schemas.common import UserCreate, Role, AssignSupervisorPayload, BulkAssignPoolPayload, PoolTransferRequestPayload, PoolTransferDecisionPayload
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", dependencies=[Depends(require_roles(Role.ADMIN))])
async def create_user(payload: UserCreate, admin_user: dict = Depends(get_current_user)):
    # 1. Validation for Duplicate Email
    if await users_col.find_one({"email": payload.email}):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

    # 2. Validation for Duplicate Phone
    if payload.phone:
        if await users_col.find_one({"phone": payload.phone}):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Phone number already registered")

    # Generate employee_id and hash password
    emp_id = gen_employee_id(payload.role.value)
    
    # 3. Validation for Duplicate Employee ID (highly unlikely due to random suffix, but checked for completeness)
    while await users_col.find_one({"employee_id": emp_id}):
        emp_id = gen_employee_id(payload.role.value)

    doc = payload.model_dump()
    doc["password"] = hash_password(doc["password"])
    doc["employee_id"] = emp_id
    doc["is_active"] = True
    doc["failed_attempts"] = 0
    doc["created_at"] = utcnow()

    # Insert into users collection
    result = await users_col.insert_one(doc)
    doc_id = str(result.inserted_id)
    doc["id"] = doc_id
    doc.pop("_id", None)

    # Clean password for sync
    sync_doc = doc.copy()
    sync_doc.pop("password", None)

    # Sync to supervisors or agents collections
    if payload.role == Role.TEAM_LEADER:
        await supervisors_col.insert_one({"_id": ObjectId(doc_id), **sync_doc})
    elif payload.role == Role.AGENT:
        await agents_col.insert_one({"_id": ObjectId(doc_id), **sync_doc})

    # Log audit trail
    await audit_logs_col.insert_one({
        "action": f"create_{payload.role.value}",
        "user_id": admin_user.get("id") or str(admin_user["_id"]),
        "target_user_id": doc_id,
        "target_employee_id": emp_id,
        "timestamp": utcnow()
    })

    # Broadcast updates via WebSocket
    await ws_manager.broadcast("global", {"event": "users_updated"})

    return {"id": doc_id, "employee_id": emp_id}


@router.get("", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def list_users(user: dict = Depends(get_current_user), role: str | None = None, pool_id: str | None = None):
    query = {}
    if user["role"] == Role.TEAM_LEADER:
        query["supervisor_id"] = user.get("id") or str(user["_id"])
    if role:
        query["role"] = role
    if pool_id:
        query["pool_id"] = pool_id

    users = []
    async for u in users_col.find(query):
        u.pop("password", None)
        users.append(oid_str(u))
    return users


@router.patch("/{user_id}/deactivate", dependencies=[Depends(require_roles(Role.ADMIN))])
async def deactivate_user(user_id: str, admin_user: dict = Depends(get_current_user)):
    await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": False}})
    await supervisors_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": False}})
    await agents_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": False}})

    # Log audit trail
    await audit_logs_col.insert_one({
        "action": "deactivate_user",
        "user_id": admin_user.get("id") or str(admin_user["_id"]),
        "target_user_id": user_id,
        "timestamp": utcnow()
    })

    # Broadcast updates
    await ws_manager.broadcast("global", {"event": "users_updated"})

    return {"status": "deactivated"}


@router.patch("/assign-supervisor", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def assign_supervisor(payload: AssignSupervisorPayload, user: dict = Depends(get_current_user)):
    """Assigns agents to a supervisor. Supports bulk/drag-and-drop actions."""
    agent_object_ids = [ObjectId(aid) for aid in payload.agent_ids]
    
    # Update main users collection
    await users_col.update_many(
        {"_id": {"$in": agent_object_ids}, "role": Role.AGENT},
        {"$set": {"supervisor_id": payload.supervisor_id, "updated_at": utcnow()}}
    )

    # Sync to agents collection
    await agents_col.update_many(
        {"_id": {"$in": agent_object_ids}},
        {"$set": {"supervisor_id": payload.supervisor_id, "updated_at": utcnow()}}
    )

    # Log audit logs for each agent reassignment
    audit_entries = []
    for aid in payload.agent_ids:
        audit_entries.append({
            "action": "assign_supervisor",
            "user_id": user.get("id") or str(user["_id"]),
            "target_user_id": aid,
            "supervisor_id": payload.supervisor_id,
            "timestamp": utcnow()
        })
    if audit_entries:
        await audit_logs_col.insert_many(audit_entries)

    # Broadcast update
    await ws_manager.broadcast("global", {"event": "users_updated"})

    return {"status": "assigned", "count": len(payload.agent_ids)}


@router.patch("/bulk-assign-pool", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def bulk_assign_pool(payload: BulkAssignPoolPayload, user: dict = Depends(get_current_user)):
    """Bulk reassigns multiple users (agents/supervisors) to a pool."""
    user_object_ids = [ObjectId(uid) for uid in payload.user_ids]

    await users_col.update_many(
        {"_id": {"$in": user_object_ids}},
        {"$set": {"pool_id": payload.pool_id, "updated_at": utcnow()}}
    )
    
    # Sync detailed collections
    await supervisors_col.update_many(
        {"_id": {"$in": user_object_ids}},
        {"$set": {"pool_id": payload.pool_id, "updated_at": utcnow()}}
    )
    await agents_col.update_many(
        {"_id": {"$in": user_object_ids}},
        {"$set": {"pool_id": payload.pool_id, "updated_at": utcnow()}}
    )

    # Audit logs
    audit_entries = []
    for uid in payload.user_ids:
        audit_entries.append({
            "action": "assign_pool",
            "user_id": user.get("id") or str(user["_id"]),
            "target_user_id": uid,
            "pool_id": payload.pool_id,
            "timestamp": utcnow()
        })
    if audit_entries:
        await audit_logs_col.insert_many(audit_entries)

    # Broadcast update
    await ws_manager.broadcast("global", {"event": "users_updated"})

    return {"status": "assigned", "count": len(payload.user_ids)}


@router.patch("/{user_id}/reassign-pool", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def reassign_pool(user_id: str, pool_id: str, user: dict = Depends(get_current_user)):
    await users_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"pool_id": pool_id}})
    await supervisors_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"pool_id": pool_id}})
    await agents_col.update_one({"_id": ObjectId(user_id)}, {"$set": {"pool_id": pool_id}})

    # Audit log
    await audit_logs_col.insert_one({
        "action": "reassign_pool",
        "user_id": user.get("id") or str(user["_id"]),
        "target_user_id": user_id,
        "pool_id": pool_id,
        "timestamp": utcnow()
    })

    # Broadcast update
    await ws_manager.broadcast("global", {"event": "users_updated"})

    return {"status": "reassigned", "pool_id": pool_id}


@router.post("/transfer-request", dependencies=[Depends(require_roles(Role.TEAM_LEADER, Role.ADMIN))])
async def create_transfer_request(payload: PoolTransferRequestPayload, user: dict = Depends(get_current_user)):
    """Submit a request to transfer an agent to a new pool. Requires Admin approval."""
    agent = await users_col.find_one({"_id": ObjectId(payload.agent_id), "role": Role.AGENT})
    if not agent:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent not found")
        
    uid = user.get("id") or str(user["_id"])
    if user["role"] == Role.TEAM_LEADER and agent.get("supervisor_id") != uid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden: you can transfer only your assigned agents")
        
    target_pool = await pools_col.find_one({"_id": ObjectId(payload.target_pool_id), "is_deleted": {"$ne": True}})
    if not target_pool:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Target pool not found or deleted")
        
    doc = {
        "agent_id": payload.agent_id,
        "agent_name": agent["name"],
        "agent_employee_id": agent.get("employee_id"),
        "source_pool_id": agent.get("pool_id"),
        "target_pool_id": payload.target_pool_id,
        "target_pool_name": target_pool["name"],
        "reason": payload.reason,
        "requested_by": uid,
        "requested_by_name": user["name"],
        "status": "pending",
        "created_at": utcnow()
    }
    
    result = await pool_transfers_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    
    # Audit log
    await audit_logs_col.insert_one({
        "action": "request_pool_transfer",
        "user_id": uid,
        "target_user_id": payload.agent_id,
        "source_pool_id": agent.get("pool_id"),
        "target_pool_id": payload.target_pool_id,
        "timestamp": utcnow()
    })
    
    await ws_manager.broadcast("global", {"event": "pool_transfer_requested", "agent_id": payload.agent_id})
    return oid_str(doc)


@router.get("/transfer-requests", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def list_transfer_requests(user: dict = Depends(get_current_user)):
    """List pool transfer requests. Supervisors see their requests; Admins see all."""
    query = {}
    if user["role"] == Role.TEAM_LEADER:
        query["requested_by"] = user.get("id") or str(user["_id"])
        
    requests = []
    async for r in pool_transfers_col.find(query).sort("created_at", -1):
        requests.append(oid_str(r))
    return requests


@router.patch("/transfer-requests/{request_id}/decision", dependencies=[Depends(require_roles(Role.ADMIN))])
async def decide_transfer_request(request_id: str, payload: PoolTransferDecisionPayload, admin_user: dict = Depends(get_current_user)):
    """Evaluate a transfer request. If approved, update the agent's pool immediately."""
    req = await pool_transfers_col.find_one({"_id": ObjectId(request_id)})
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Transfer request not found")
        
    if req["status"] != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Request already decided: status is {req['status']}")
        
    new_status = "approved" if payload.approved else "rejected"
    update_data = {
        "status": new_status,
        "remarks": payload.remarks,
        "decided_by": admin_user.get("id") or str(admin_user["_id"]),
        "decided_at": utcnow()
    }
    
    await pool_transfers_col.update_one({"_id": ObjectId(request_id)}, {"$set": update_data})
    
    if payload.approved:
        agent_id = req["agent_id"]
        target_pool_id = req["target_pool_id"]
        await users_col.update_one({"_id": ObjectId(agent_id)}, {"$set": {"pool_id": target_pool_id}})
        await agents_col.update_one({"_id": ObjectId(agent_id)}, {"$set": {"pool_id": target_pool_id}})
        
    await audit_logs_col.insert_one({
        "action": f"decide_pool_transfer_{new_status}",
        "user_id": admin_user.get("id") or str(admin_user["_id"]),
        "target_user_id": req["agent_id"],
        "transfer_request_id": request_id,
        "timestamp": utcnow()
    })
    
    await ws_manager.broadcast("global", {"event": "users_updated"})
    return {"status": new_status}


@router.patch("/status", dependencies=[Depends(require_roles(Role.AGENT, Role.TEAM_LEADER, Role.ADMIN))])
async def update_user_status(status_val: str, user: dict = Depends(get_current_user)):
    """Allows agents or supervisors to change their active status (online, offline, busy, break)."""
    uid = user.get("id") or str(user["_id"])
    if status_val not in ["online", "offline", "busy", "break"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid status value")
        
    await users_col.update_one({"_id": ObjectId(uid)}, {"$set": {"status": status_val}})
    if user["role"] == Role.AGENT:
        await agents_col.update_one({"_id": ObjectId(uid)}, {"$set": {"status": status_val}})
    elif user["role"] == Role.TEAM_LEADER:
        await supervisors_col.update_one({"_id": ObjectId(uid)}, {"$set": {"status": status_val}})
        
    await audit_logs_col.insert_one({
        "action": "update_status",
        "user_id": uid,
        "status": status_val,
        "timestamp": utcnow()
    })
    
    await ws_manager.broadcast("global", {"event": "users_updated"})
    return {"status": "success", "user_status": status_val}
