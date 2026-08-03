import io
import re
import pandas as pd
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from bson import ObjectId
from pydantic import BaseModel, Field
from app.core.database import leads_col, imports_col, audit_logs_col, users_col
from app.core.utils import gen_lead_id, gen_import_id, utcnow, oid_str
from app.core.deps import require_roles, get_current_user
from app.schemas.common import LeadCreate, LeadAssign, DispositionUpdate, Role, LeadStatus
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/api/leads", tags=["leads"])


class LeadImportProcessPayload(BaseModel):
    pool_id: str
    campaign_id: Optional[str] = None
    supervisor_id: Optional[str] = None
    agent_id: Optional[str] = None
    mapping: dict
    rows: list[dict]


def _uid(user: dict) -> str:
    return user.get("id") or str(user["_id"])


def normalize_phone(phone_str: str) -> str:
    if not phone_str:
        return ""
    cleaned = str(phone_str).strip()
    is_plus = cleaned.startswith("+")
    digits = re.sub(r"\D", "", cleaned)
    return f"+{digits}" if is_plus else digits


def is_valid_email(email_str: str) -> bool:
    if not email_str:
        return False
    email_str = str(email_str).strip()
    pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    return bool(re.match(pattern, email_str))


@router.post("", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def create_lead(payload: LeadCreate, user: dict = Depends(get_current_user)):
    normalized = normalize_phone(payload.phone)
    if not normalized:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or empty phone number")

    existing = await leads_col.find_one({"phone": normalized, "pool_id": payload.pool_id})
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Duplicate lead: phone number already exists in this pool")
    
    if payload.email:
        email_clean = str(payload.email).strip().lower()
        if not is_valid_email(email_clean):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid email format")
        existing_email = await leads_col.find_one({"email": email_clean, "pool_id": payload.pool_id})
        if existing_email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Duplicate lead: email already exists in this pool")

    doc = payload.model_dump()
    doc["phone"] = normalized
    if doc.get("email"):
        doc["email"] = doc["email"].strip().lower()
    
    doc["lead_id"] = gen_lead_id()
    doc["status"] = LeadStatus.NEW
    doc["assigned_agent_id"] = None
    doc["supervisor_id"] = _uid(user) if user.get("role") == Role.TEAM_LEADER else None
    doc["created_by"] = _uid(user)
    doc["created_at"] = utcnow()
    
    result = await leads_col.insert_one(doc)
    doc["_id"] = result.inserted_id

    await audit_logs_col.insert_one({
        "action": "create_lead",
        "user_id": _uid(user),
        "lead_id": doc["lead_id"],
        "lead_name": doc["name"],
        "timestamp": utcnow()
    })

    await ws_manager.broadcast("global", {"event": "leads_updated"})
    return oid_str(doc)


@router.post("/upload-preview", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def upload_preview(file: UploadFile = File(...)):
    content = await file.read()
    if file.filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    elif file.filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(content))
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only .csv, .xlsx, .xls files are supported")

    headers = [str(col).strip() for col in df.columns]
    suggested = {}
    for h in headers:
        hl = h.lower()
        if "name" in hl:
            suggested["name"] = h
        elif "phone" in hl or "ph" in hl or "mobile" in hl or "contact" in hl:
            suggested["phone"] = h
        elif "email" in hl or "mail" in hl:
            suggested["email"] = h
        elif "location" in hl or "city" in hl or "address" in hl or "state" in hl:
            suggested["location"] = h
        elif "lang" in hl:
            suggested["language"] = h

    df_clean = df.where(pd.notnull(df), None)
    rows = df_clean.head(10).to_dict(orient="records")
    all_rows = df_clean.to_dict(orient="records")

    return {
        "headers": headers,
        "rows": rows,
        "suggested_mapping": suggested,
        "all_rows": all_rows,
        "total_records": len(df)
    }


@router.post("/import-process", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def import_process(payload: LeadImportProcessPayload, user: dict = Depends(get_current_user)):
    mapping = payload.mapping
    rows = payload.rows
    pool_id = payload.pool_id
    campaign_id = payload.campaign_id
    supervisor_id = payload.supervisor_id
    agent_id = payload.agent_id

    import_id = gen_import_id()
    inserted_leads = []
    skipped_duplicates = 0
    skipped_invalid = 0
    total_processed = 0

    name_col = mapping.get("name")
    phone_col = mapping.get("phone")
    email_col = mapping.get("email")
    location_col = mapping.get("location")
    language_col = mapping.get("language")

    if not name_col or not phone_col:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mapping configuration must contain name and phone columns")

    for row in rows:
        name_val = str(row.get(name_col) or "").strip()
        phone_val = str(row.get(phone_col) or "").strip()
        email_val = str(row.get(email_col) or "").strip() if email_col else ""
        location_val = str(row.get(location_col) or "").strip() if location_col else ""
        language_val = str(row.get(language_val) or "").strip() if language_col else "English"

        if not name_val and not phone_val:
            continue

        total_processed += 1

        normalized_phone = normalize_phone(phone_val)
        if not name_val or not normalized_phone:
            skipped_invalid += 1
            continue

        email_clean = email_val.lower() if email_val else None
        if email_clean and not is_valid_email(email_clean):
            skipped_invalid += 1
            continue

        duplicate = await leads_col.find_one({
            "$or": [
                {"phone": normalized_phone},
                *( [{"email": email_clean}] if email_clean else [] )
            ],
            "pool_id": pool_id
        })
        if duplicate:
            skipped_duplicates += 1
            continue

        lead_doc = {
            "name": name_val,
            "phone": normalized_phone,
            "email": email_clean,
            "location": location_val or None,
            "language": language_val,
            "lead_id": gen_lead_id(),
            "pool_id": pool_id,
            "campaign_id": campaign_id or None,
            "supervisor_id": supervisor_id or None,
            "assigned_agent_id": agent_id or None,
            "source": "import",
            "status": LeadStatus.NEW,
            "created_by": _uid(user),
            "created_at": utcnow(),
            "extra": {}
        }
        
        inserted_leads.append(lead_doc)

    inserted_count = 0
    if inserted_leads:
        result = await leads_col.insert_many(inserted_leads)
        inserted_count = len(result.inserted_ids)

    report_doc = {
        "import_id": import_id,
        "filename": "Imported Web Upload",
        "pool_id": pool_id,
        "campaign_id": campaign_id,
        "supervisor_id": supervisor_id,
        "agent_id": agent_id,
        "total_processed": total_processed,
        "inserted": inserted_count,
        "skipped_duplicates": skipped_duplicates,
        "skipped_invalid": skipped_invalid,
        "created_by": _uid(user),
        "created_at": utcnow()
    }
    await imports_col.insert_one(report_doc)

    await audit_logs_col.insert_one({
        "action": "import_leads",
        "user_id": _uid(user),
        "import_id": import_id,
        "inserted_count": inserted_count,
        "timestamp": utcnow()
    })

    await ws_manager.broadcast("global", {"event": "leads_updated"})
    return oid_str(report_doc)


@router.post("/assign", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def assign_leads(payload: LeadAssign, user: dict = Depends(get_current_user)):
    lead_object_ids = [ObjectId(i) for i in payload.lead_ids if ObjectId.is_valid(i)]
    
    agent = await users_col.find_one({"_id": ObjectId(payload.agent_id)}) if ObjectId.is_valid(payload.agent_id) else None
    supervisor_id = agent.get("supervisor_id") if agent else None

    result = await leads_col.update_many(
        {"_id": {"$in": lead_object_ids}},
        {
            "$set": {
                "assigned_agent_id": payload.agent_id,
                "supervisor_id": supervisor_id,
                "assigned_at": utcnow()
            }
        },
    )

    await audit_logs_col.insert_one({
        "action": "assign_leads",
        "user_id": _uid(user),
        "agent_id": payload.agent_id,
        "count": result.modified_count,
        "timestamp": utcnow()
    })

    await ws_manager.broadcast("global", {"event": "leads_updated"})
    return {"assigned_count": result.modified_count}


@router.get("")
async def list_leads(user: dict = Depends(get_current_user), pool_id: str | None = None,
                      status_filter: str | None = None):
    query = {}
    uid = _uid(user)
    
    if user["role"] == Role.AGENT:
        query["$or"] = [
            {"assigned_agent_id": uid},
            {"created_by": uid}
        ]
    elif user["role"] == Role.TEAM_LEADER:
        # Team leaders can view leads in their pool, leads assigned to them/their team, or all unassigned leads
        team_or = [
            {"supervisor_id": uid},
            {"created_by": uid},
            {"assigned_agent_id": uid},
            {"assigned_agent_id": None}
        ]
        if user.get("pool_id"):
            team_or.append({"pool_id": user.get("pool_id")})
        query["$or"] = team_or
        
    if pool_id:
        query["pool_id"] = pool_id
    if status_filter:
        query["status"] = status_filter
        
    leads = []
    async for l in leads_col.find(query).sort("created_at", -1).limit(500):
        leads.append(oid_str(l))
    return leads


@router.get("/imports", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def list_imports():
    imports = []
    async for imp in imports_col.find({}).sort("created_at", -1):
        imports.append(oid_str(imp))
    return imports


@router.patch("/{lead_id}/disposition", dependencies=[Depends(require_roles(Role.AGENT, Role.TEAM_LEADER, Role.ADMIN))])
async def update_disposition(lead_id: str, payload: DispositionUpdate, user: dict = Depends(get_current_user)):
    update = {"status": payload.status, "updated_at": utcnow()}
    if payload.sub_disposition:
        update["sub_disposition"] = payload.sub_disposition
    if payload.notes:
        update["last_note"] = payload.notes
    if payload.follow_up_at:
        update["follow_up_at"] = payload.follow_up_at
        
    query = {"_id": ObjectId(lead_id)} if ObjectId.is_valid(lead_id) else {"lead_id": lead_id}
    await leads_col.update_one(query, {"$set": update})

    await audit_logs_col.insert_one({
        "action": "update_disposition",
        "user_id": _uid(user),
        "lead_id": lead_id,
        "status": payload.status,
        "timestamp": utcnow()
    })

    await ws_manager.broadcast("global", {"event": "leads_updated"})
    return {"status": "updated"}


@router.get("/{lead_id}")
async def get_lead(lead_id: str, user: dict = Depends(get_current_user)):
    query = {"_id": ObjectId(lead_id)} if ObjectId.is_valid(lead_id) else {"lead_id": lead_id}
    lead = await leads_col.find_one(query)
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Lead '{lead_id}' not found")
    return oid_str(lead)


@router.delete("/{lead_id}", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
async def delete_lead(lead_id: str, user: dict = Depends(get_current_user)):
    """Permanently delete a lead document from MongoDB by ObjectId or lead_id string."""
    if not lead_id or not lead_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lead ID parameter is required."
        )

    clean_id = lead_id.strip()

    # Validate ObjectId or lead_id pattern
    query = {}
    if ObjectId.is_valid(clean_id):
        query = {"$or": [{"_id": ObjectId(clean_id)}, {"lead_id": clean_id}]}
    else:
        query = {"lead_id": clean_id}

    try:
        lead = await leads_col.find_one(query)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid lead identifier: {str(e)}"
        )

    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lead with ID '{clean_id}' not found in database."
        )

    try:
        result = await leads_col.delete_one({"_id": lead["_id"]})
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete lead document from MongoDB."
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database server error while deleting lead: {str(e)}"
        )

    # Audit Log
    try:
        await audit_logs_col.insert_one({
            "action": "delete_lead",
            "user_id": _uid(user),
            "lead_id": str(lead.get("_id")),
            "lead_code": lead.get("lead_id"),
            "lead_name": lead.get("name"),
            "timestamp": utcnow()
        })
    except Exception as e:
        print(f"Warning: Audit log insertion failed: {e}")

    # Broadcast WebSocket event
    try:
        await ws_manager.broadcast("global", {"event": "leads_updated"})
    except Exception as e:
        print(f"Warning: WebSocket broadcast failed: {e}")

    return {
        "status": "success",
        "detail": "Lead deleted successfully.",
        "deleted_id": str(lead.get("_id")),
        "lead_code": lead.get("lead_id")
    }

