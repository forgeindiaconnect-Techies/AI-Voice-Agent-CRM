from fastapi import APIRouter, HTTPException, Depends, status, Request
from bson import ObjectId
from datetime import timedelta
from app.core.database import users_col, audit_logs_col
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.utils import gen_employee_id, utcnow, oid_str
from app.core.deps import get_current_user, require_roles
from app.schemas.common import UserCreate, UserLogin, Role

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/bootstrap-admin")
async def bootstrap_admin(payload: UserCreate):
    """One-time setup: creates the first Admin account. Rejected if any admin already exists."""
    existing_admin = await users_col.find_one({"role": Role.ADMIN})
    if existing_admin:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Admin already exists. Use /users to create more.")
    doc = payload.model_dump()
    doc["password"] = hash_password(doc["password"])
    doc["employee_id"] = gen_employee_id("admin")
    doc["role"] = Role.ADMIN
    doc["is_active"] = True
    doc["failed_attempts"] = 0
    doc["created_at"] = utcnow()
    result = await users_col.insert_one(doc)
    return {"id": str(result.inserted_id), "employee_id": doc["employee_id"]}


@router.post("/login")
async def login(payload: UserLogin, request: Request):
    client_host = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    clean_email = payload.email.strip()

    # Case-insensitive email or exact Employee ID lookup
    import re
    email_pattern = re.compile(f"^{re.escape(clean_email)}$", re.IGNORECASE)
    user = await users_col.find_one({
        "$or": [
            {"email": email_pattern},
            {"employee_id": clean_email}
        ]
    })
    if not user:
        await audit_logs_col.insert_one({
            "action": "login_failed",
            "email": payload.email,
            "ip_address": client_host,
            "user_agent": user_agent,
            "reason": "user_not_found",
            "timestamp": utcnow()
        })
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    # Check lock status
    locked_until = user.get("locked_until")
    if locked_until:
        if utcnow() < locked_until:
            wait_seconds = int((locked_until - utcnow()).total_seconds())
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Account locked due to too many failed attempts. Try again in {wait_seconds} seconds."
            )

    if not user.get("is_active", True):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is deactivated")

    if not verify_password(payload.password, user["password"]):
        failed_attempts = user.get("failed_attempts", 0) + 1
        update_doc = {"$set": {"failed_attempts": failed_attempts}}
        
        if failed_attempts >= 5:
            update_doc["$set"]["locked_until"] = utcnow() + timedelta(minutes=15)
            reason = "account_locked"
        else:
            reason = "invalid_password"

        await users_col.update_one({"_id": user["_id"]}, update_doc)

        await audit_logs_col.insert_one({
            "action": "login_failed",
            "user_id": str(user["_id"]),
            "email": payload.email,
            "ip_address": client_host,
            "user_agent": user_agent,
            "reason": reason,
            "timestamp": utcnow()
        })

        if failed_attempts >= 5:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Account locked due to too many failed attempts.")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    # Success, reset failed attempts & lockout, auto-hash plain-text password if needed
    from app.core.security import hash_password
    set_fields: dict = {"failed_attempts": 0}
    if not (user["password"].startswith("$2b$") or user["password"].startswith("$2a$") or user["password"].startswith("$2y$")):
        set_fields["password"] = hash_password(payload.password)

    await users_col.update_one(
        {"_id": user["_id"]},
        {"$set": set_fields, "$unset": {"locked_until": ""}}
    )

    access = create_access_token(str(user["_id"]), user["role"])
    refresh = create_refresh_token(str(user["_id"]))

    await audit_logs_col.insert_one({
        "action": "login_success",
        "user_id": str(user["_id"]),
        "email": user["email"],
        "ip_address": client_host,
        "user_agent": user_agent,
        "timestamp": utcnow()
    })

    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "name": user["name"],
            "role": user["role"],
            "employee_id": user["employee_id"],
            "pool_id": user.get("pool_id"),
        },
    }


@router.post("/refresh")
async def refresh_token(refresh_token: str):
    payload = decode_token(refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = await users_col.find_one({"_id": ObjectId(payload["sub"])})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return {"access_token": create_access_token(str(user["_id"]), user["role"]), "token_type": "bearer"}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return oid_str({k: v for k, v in user.items() if k != "password"})


@router.get("/history")
async def login_history(user: dict = Depends(get_current_user)):
    uid = user.get("id") or str(user["_id"])
    logs = []
    # Fetch recent login_success or login_failed events for this user
    async for log in audit_logs_col.find({
        "$or": [
            {"user_id": uid},
            {"email": user["email"]}
        ],
        "action": {"$in": ["login_success", "login_failed"]}
    }).sort("timestamp", -1).limit(10):
        logs.append(oid_str(log))
    return logs

