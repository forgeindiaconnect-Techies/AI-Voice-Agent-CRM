from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from bson import ObjectId
from app.core.security import decode_token
from app.core.database import users_col

from app.schemas.common import Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = await users_col.find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("is_active", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    user["_id"] = str(user["_id"])
    if user.get("role") == "supervisor":
        user["role"] = Role.TEAM_LEADER.value
    return user


def require_roles(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role")
        normalized_role = "team_leader" if user_role == "supervisor" else user_role
        
        allowed_roles = set()
        for r in roles:
            r_str = str(r.value) if hasattr(r, "value") else str(r)
            allowed_roles.add(r_str)
            if r_str in (Role.TEAM_LEADER.value, "team_leader"):
                allowed_roles.add("supervisor")
                
        if user_role not in allowed_roles and normalized_role not in allowed_roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions for this action")
        return user
    return checker
