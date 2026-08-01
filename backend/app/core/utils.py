import random
import string
from datetime import datetime, timezone


def gen_employee_id(role: str) -> str:
    prefix = {"admin": "ADM", "team_leader": "TL", "agent": "AGT"}.get(role, "EMP")
    suffix = "".join(random.choices(string.digits, k=5))
    return f"{prefix}{suffix}"


def gen_lead_id() -> str:
    suffix = "".join(random.choices(string.digits, k=6))
    return f"LD{suffix}"


def gen_campaign_id() -> str:
    suffix = "".join(random.choices(string.digits, k=5))
    return f"CMP{suffix}"


def gen_import_id() -> str:
    suffix = "".join(random.choices(string.digits, k=5))
    return f"IMP{suffix}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def oid_str(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc
