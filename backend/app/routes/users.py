import logging
import re
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from app.core.database import users_col, supervisors_col, agents_col, audit_logs_col, pool_transfers_col, pools_col
from app.core.security import hash_password
from app.core.utils import gen_employee_id, utcnow, oid_str
from app.core.deps import require_roles, get_current_user
from app.schemas.common import UserCreate, UserUpdate, Role, AssignSupervisorPayload, BulkAssignPoolPayload, PoolTransferRequestPayload, PoolTransferDecisionPayload
from app.services.ws_manager import ws_manager

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", dependencies=[Depends(require_roles(Role.ADMIN))])
async def create_user(payload: UserCreate, admin_user: dict = Depends(get_current_user)):
    admin_id = admin_user.get("id") or str(admin_user.get("_id", ""))
    logger.info(f"[CREATE USER] Request received by admin '{admin_user.get('email')}' (ID: {admin_id}) for email '{payload.email}', role '{payload.role}'")

    # 1. Normalize and sanitize fields
    email = payload.email.lower().strip()
    name = payload.name.strip()
    phone = payload.phone.strip() if payload.phone and payload.phone.strip() else None
    password = payload.password
    role_str = payload.role.value if isinstance(payload.role, Role) else str(payload.role)

    if not name:
        logger.warning("[CREATE USER] Validation failed: Full Name is required.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Full Name is required.")

    if not email:
        logger.warning("[CREATE USER] Validation failed: Email address is required.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email address is required.")

    if not password or len(password) < 6:
        logger.warning(f"[CREATE USER] Validation failed: Password too short for {email}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters long.")

    # 2. Duplicate Check: Email (case-insensitive)
    existing_email = await users_col.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if existing_email:
        logger.warning(f"[CREATE USER] Duplicate email attempt: '{email}'")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Email '{email}' is already registered.")

    # 3. Duplicate Check: Phone Number
    if phone:
        existing_phone = await users_col.find_one({"phone": phone})
        if existing_phone:
            logger.warning(f"[CREATE USER] Duplicate phone attempt: '{phone}'")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Phone number '{phone}' is already registered.")

    # 4. Generate or Validate Employee ID
    if payload.employee_id and payload.employee_id.strip():
        emp_id = payload.employee_id.strip().upper()
        if await users_col.find_one({"employee_id": emp_id}):
            logger.warning(f"[CREATE USER] Duplicate employee_id attempt: '{emp_id}'")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Employee ID '{emp_id}' is already assigned.")
    else:
        emp_id = gen_employee_id(role_str)
        while await users_col.find_one({"employee_id": emp_id}):
            emp_id = gen_employee_id(role_str)

    # 5. Build MongoDB Document safely (mode="json" converts Enums to raw primitive values)
    doc = payload.model_dump(mode="json")
    doc["name"] = name
    doc["email"] = email
    doc["phone"] = phone
    doc["role"] = role_str
    doc["password"] = hash_password(password)
    doc["employee_id"] = emp_id
    doc["pool_id"] = payload.pool_id if payload.pool_id and payload.pool_id.strip() else None
    doc["supervisor_id"] = payload.supervisor_id if payload.supervisor_id and payload.supervisor_id.strip() else None
    doc["is_active"] = payload.is_active if payload.is_active is not None else True
    doc["failed_attempts"] = 0
    doc["created_at"] = utcnow()
    doc["updated_at"] = utcnow()

    # 6. Insert into MongoDB
    try:
        result = await users_col.insert_one(doc)
        doc_id = str(result.inserted_id)
        doc["id"] = doc_id
        doc.pop("_id", None)

        # Sync to role-specific collections
        sync_doc = doc.copy()
        sync_doc.pop("password", None)

        if role_str == Role.TEAM_LEADER.value:
            await supervisors_col.insert_one({"_id": ObjectId(doc_id), **sync_doc})
        elif role_str == Role.AGENT.value:
            await agents_col.insert_one({"_id": ObjectId(doc_id), **sync_doc})

        # 7. Audit log & WS Notification
        await audit_logs_col.insert_one({
            "action": f"create_{role_str}",
            "user_id": admin_id,
            "target_user_id": doc_id,
            "target_employee_id": emp_id,
            "target_email": email,
            "timestamp": utcnow()
        })

        logger.info(f"[CREATE USER SUCCESS] User '{email}' ({role_str}) created successfully. ID: {doc_id}, Employee ID: {emp_id}")
        await ws_manager.broadcast("global", {"event": "users_updated", "user_id": doc_id})

        return {
            "id": doc_id,
            "employee_id": emp_id,
            "name": name,
            "email": email,
            "role": role_str,
            "status": "created",
            "message": f"User '{name}' registered successfully."
        }
    except Exception as err:
        logger.error(f"[CREATE USER ERROR] MongoDB save failed for '{email}': {err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register user account: {str(err)}"
        )


@router.get("", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
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
        user_id_val = str(u.get("_id") or u.get("id", ""))
        u_formatted = oid_str(u)
        u_formatted["id"] = user_id_val
        users.append(u_formatted)
    return users


@router.patch("/{user_id}/deactivate", dependencies=[Depends(require_roles(Role.ADMIN))])
async def deactivate_user(user_id: str, admin_user: dict = Depends(get_current_user)):
    user_id = user_id.strip()
    query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}, {"id": user_id}]} if ObjectId.is_valid(user_id) else {"$or": [{"_id": user_id}, {"id": user_id}]}
    existing = await users_col.find_one(query)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User account not found")

    target_id = str(existing.get("_id") or existing.get("id"))
    update_q = {"$or": [{"_id": ObjectId(target_id)}, {"_id": target_id}, {"id": target_id}]} if ObjectId.is_valid(target_id) else {"$or": [{"_id": target_id}, {"id": target_id}]}

    await users_col.update_one(update_q, {"$set": {"is_active": False}})
    await supervisors_col.update_many(update_q, {"$set": {"is_active": False}})
    await agents_col.update_many(update_q, {"$set": {"is_active": False}})

    # Log audit trail
    await audit_logs_col.insert_one({
        "action": "deactivate_user",
        "user_id": admin_user.get("id") or str(admin_user["_id"]),
        "target_user_id": target_id,
        "timestamp": utcnow()
    })

    await ws_manager.broadcast("global", {"event": "users_updated", "user_id": target_id})
    return {"status": "deactivated", "id": target_id}


@router.put("/{user_id}", dependencies=[Depends(require_roles(Role.ADMIN))])
async def update_user(user_id: str, payload: UserUpdate, admin_user: dict = Depends(get_current_user)):
    """Updates an existing user's details (Admin only)."""
    user_id = user_id.strip()
    query = {"$or": [{"_id": ObjectId(user_id)}, {"_id": user_id}, {"id": user_id}]} if ObjectId.is_valid(user_id) else {"$or": [{"_id": user_id}, {"id": user_id}]}
    existing_user = await users_col.find_one(query)
    if not existing_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User account not found")

    target_id = str(existing_user.get("_id") or existing_user.get("id"))

    update_data = {}
    if payload.name is not None and payload.name.strip():
        update_data["name"] = payload.name.strip()
    if payload.email is not None and payload.email.strip():
        email_clean = payload.email.lower().strip()
        dup_query = {"email": email_clean}
        if ObjectId.is_valid(target_id):
            dup_query["_id"] = {"$ne": ObjectId(target_id)}
        else:
            dup_query["_id"] = {"$ne": target_id}

        dup = await users_col.find_one(dup_query)
        if dup:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Email address '{email_clean}' is already registered.")
        update_data["email"] = email_clean
    if payload.password and payload.password.strip():
        update_data["password"] = hash_password(payload.password)
    if payload.role is not None:
        role_str = payload.role.value if isinstance(payload.role, Role) else str(payload.role)
        update_data["role"] = role_str
    if payload.phone is not None:
        update_data["phone"] = payload.phone
    if payload.employee_id is not None:
        update_data["employee_id"] = payload.employee_id
    if payload.pool_id is not None:
        update_data["pool_id"] = payload.pool_id
    if payload.supervisor_id is not None:
        update_data["supervisor_id"] = payload.supervisor_id
    if payload.department is not None:
        update_data["department"] = payload.department
    if payload.shift is not None:
        update_data["shift"] = payload.shift
    if payload.language is not None:
        update_data["language"] = payload.language
    if payload.is_active is not None:
        update_data["is_active"] = payload.is_active

    update_data["updated_at"] = utcnow()

    if update_data:
        update_q = {"$or": [{"_id": ObjectId(target_id)}, {"_id": target_id}, {"id": target_id}]} if ObjectId.is_valid(target_id) else {"$or": [{"_id": target_id}, {"id": target_id}]}
        await users_col.update_one(update_q, {"$set": update_data})
        if existing_user.get("role") == Role.AGENT or update_data.get("role") == Role.AGENT:
            await agents_col.update_many(update_q, {"$set": update_data})
        elif existing_user.get("role") == Role.TEAM_LEADER or update_data.get("role") == Role.TEAM_LEADER:
            await supervisors_col.update_many(update_q, {"$set": update_data})

    await audit_logs_col.insert_one({
        "action": "update_user",
        "user_id": admin_user.get("id") or str(admin_user["_id"]),
        "target_user_id": target_id,
        "updated_fields": list(update_data.keys()),
        "timestamp": utcnow()
    })

    await ws_manager.broadcast("global", {"event": "users_updated", "user_id": target_id})
    updated_q = {"$or": [{"_id": ObjectId(target_id)}, {"_id": target_id}, {"id": target_id}]} if ObjectId.is_valid(target_id) else {"$or": [{"_id": target_id}, {"id": target_id}]}
    updated = await users_col.find_one(updated_q)
    return oid_str(updated)


@router.delete("/{user_id}", dependencies=[Depends(require_roles(Role.ADMIN))])
async def delete_user(user_id: str, admin_user: dict = Depends(get_current_user)):
    """Permanently deletes a user account (Admin only)."""
    user_id = user_id.strip()
    logger.info(f"[DELETE USER] Request received for user_id='{user_id}' by admin '{admin_user.get('email')}'")

    # Flexible multi-field lookup: matches _id (ObjectId or string), id, employee_id, or email
    or_conds = [{"_id": user_id}, {"id": user_id}, {"employee_id": user_id}, {"email": user_id.lower()}]
    if ObjectId.is_valid(user_id):
        or_conds.insert(0, {"_id": ObjectId(user_id)})

    existing_user = await users_col.find_one({"$or": or_conds})
    
    if not existing_user:
        logger.warning(f"[DELETE USER FAILED] User with identifier '{user_id}' not found in MongoDB.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User account '{user_id}' not found.")

    actual_id = str(existing_user.get("_id") or existing_user.get("id"))
    admin_id = admin_user.get("id") or str(admin_user.get("_id", ""))

    if actual_id == admin_id or user_id == admin_id or existing_user.get("email") == admin_user.get("email"):
        logger.warning(f"[DELETE USER BLOCKED] Admin '{admin_user.get('email')}' attempted to delete their own account.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own active admin account.")

    # Build comprehensive multi-field deletion query
    del_conds = [{"_id": actual_id}, {"id": actual_id}]
    if existing_user.get("employee_id"):
        del_conds.append({"employee_id": existing_user["employee_id"]})
    if existing_user.get("email"):
        del_conds.append({"email": existing_user["email"]})
    if ObjectId.is_valid(actual_id):
        del_conds.insert(0, {"_id": ObjectId(actual_id)})

    del_query = {"$or": del_conds}

    await users_col.delete_many(del_query)
    await agents_col.delete_many(del_query)
    await supervisors_col.delete_many(del_query)

    # Clear supervisor assignments for any dependent agents
    await users_col.update_many({"supervisor_id": actual_id}, {"$set": {"supervisor_id": None}})

    await audit_logs_col.insert_one({
        "action": "delete_user",
        "user_id": admin_id,
        "target_user_id": actual_id,
        "target_email": existing_user.get("email"),
        "timestamp": utcnow()
    })

    logger.info(f"[DELETE USER SUCCESS] User '{existing_user.get('email')}' (ID: {actual_id}) deleted successfully.")
    await ws_manager.broadcast("global", {"event": "users_updated", "deleted_user_id": actual_id})

    return {"status": "deleted", "id": actual_id, "name": existing_user.get("name"), "message": f"User '{existing_user.get('name')}' deleted successfully."}




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
