import random
import re
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


def gen_ai_agent_id() -> str:
    suffix = "".join(random.choices(string.digits, k=5))
    return f"AI-{suffix}"



def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def oid_str(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


def normalize_phone(phone_str: str) -> str:
    if not phone_str:
        return ""
    cleaned = str(phone_str).strip()
    digits = re.sub(r"\D", "", cleaned)
    if not digits:
        return ""
    if len(digits) == 10 and digits[0] in "6789":
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91") and digits[2] in "6789":
        return f"+91{digits[2:]}"
    if len(digits) == 11 and digits.startswith("0") and digits[1] in "6789":
        return f"+91{digits[1:]}"
    if cleaned.startswith("+"):
        return f"+{digits}"
    return f"+91{digits}"
