from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.core.config import settings

# Fix passlib 1.7.4 compatibility with bcrypt 4.x on Python 3.12 (prevents trapped error reading bcrypt version)
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type("about", (), {"__version__": getattr(bcrypt, "__version__", "4.0.1")})()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _truncate_pwd(password: str) -> str:
    if not password:
        return ""
    pwd_bytes = password.encode("utf-8")[:72]
    return pwd_bytes.decode("utf-8", errors="ignore")


def hash_password(password: str) -> str:
    return pwd_context.hash(_truncate_pwd(password))


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    # Support legacy plain-text match if password was seeded unhashed
    if not (hashed.startswith("$2b$") or hashed.startswith("$2a$") or hashed.startswith("$2y$")):
        return plain.strip() == hashed.strip()
    try:
        return pwd_context.verify(_truncate_pwd(plain), hashed)
    except Exception:
        return False


def create_token(data: dict, expires_delta: timedelta, token_type: str = "access") -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire, "type": token_type})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: str, role: str) -> str:
    return create_token(
        {"sub": user_id, "role": role},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        "access",
    )


def create_refresh_token(user_id: str) -> str:
    return create_token(
        {"sub": user_id},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        "refresh",
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
