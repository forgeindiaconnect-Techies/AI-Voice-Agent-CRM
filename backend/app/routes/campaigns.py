from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from app.core.database import campaigns_col, audit_logs_col
from app.core.utils import gen_campaign_id, utcnow, oid_str
from app.core.deps import require_roles, get_current_user
from app.schemas.common import CampaignCreate, Role
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


@router.post("", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def create_campaign(payload: CampaignCreate, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc["campaign_id"] = gen_campaign_id()
    doc["created_by"] = user.get("id") or str(user["_id"])
    doc["created_at"] = utcnow()
    doc["status"] = "active"
    
    if user["role"] == Role.TEAM_LEADER:
        doc["supervisor_id"] = user.get("id") or str(user["_id"])
        
    result = await campaigns_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    
    # Audit log
    await audit_logs_col.insert_one({
        "action": "create_campaign",
        "user_id": doc["created_by"],
        "campaign_id": doc["campaign_id"],
        "campaign_name": doc["name"],
        "timestamp": utcnow()
    })

    # Broadcast updates
    await ws_manager.broadcast("global", {"event": "campaigns_updated"})

    return oid_str(doc)


@router.get("")
async def list_campaigns(
    pool_id: str | None = None,
    supervisor_id: str | None = None,
    user: dict = Depends(get_current_user)
):
    query = {}
    if user["role"] == Role.TEAM_LEADER:
        query["supervisor_id"] = user.get("id") or str(user["_id"])
    else:
        if pool_id:
            query["pool_id"] = pool_id
        if supervisor_id:
            query["supervisor_id"] = supervisor_id
    
    # Do not return archived campaigns unless explicitly requested (exclude archived by default)
    query["status"] = {"$ne": "archived"}

    campaigns = []
    async for c in campaigns_col.find(query).sort("created_at", -1):
        campaigns.append(oid_str(c))
    return campaigns


@router.patch("/{campaign_id}/status", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def update_status(campaign_id: str, status_value: str, user: dict = Depends(get_current_user)):
    if status_value not in ["active", "paused", "archived", "stopped"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid status. Must be active, paused, archived, or stopped")
    
    result = await campaigns_col.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"status": status_value, "updated_at": utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")

    campaign = await campaigns_col.find_one({"_id": ObjectId(campaign_id)})

    # Audit log
    await audit_logs_col.insert_one({
        "action": f"{status_value}_campaign",
        "user_id": user.get("id") or str(user["_id"]),
        "campaign_id": campaign.get("campaign_id") if campaign else campaign_id,
        "timestamp": utcnow()
    })

    # Broadcast updates
    await ws_manager.broadcast("global", {"event": "campaigns_updated"})

    return {"status": status_value}


@router.post("/{campaign_id}/clone", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def clone_campaign(campaign_id: str, user: dict = Depends(get_current_user)):
    existing = await campaigns_col.find_one({"_id": ObjectId(campaign_id)})
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign to clone not found")

    cloned_doc = existing.copy()
    cloned_doc.pop("_id", None)
    cloned_doc["name"] = f"Copy of {existing['name']}"
    cloned_doc["campaign_id"] = gen_campaign_id()
    cloned_doc["created_by"] = user.get("id") or str(user["_id"])
    cloned_doc["created_at"] = utcnow()
    cloned_doc["status"] = "active"

    result = await campaigns_col.insert_one(cloned_doc)
    cloned_doc["_id"] = result.inserted_id

    # Audit log
    await audit_logs_col.insert_one({
        "action": "clone_campaign",
        "user_id": cloned_doc["created_by"],
        "source_campaign_id": existing.get("campaign_id"),
        "cloned_campaign_id": cloned_doc["campaign_id"],
        "timestamp": utcnow()
    })

    # Broadcast updates
    await ws_manager.broadcast("global", {"event": "campaigns_updated"})

    return oid_str(cloned_doc)


@router.patch("/{campaign_id}/agents", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def assign_campaign_agents(campaign_id: str, agent_ids: list[str], user: dict = Depends(get_current_user)):
    """Allows supervisors/admins to assign specific agents to a campaign."""
    campaign = await campaigns_col.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
        
    uid = user.get("id") or str(user["_id"])
    if user["role"] == Role.TEAM_LEADER and campaign.get("supervisor_id") != uid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden: you can update only your assigned campaigns")
        
    await campaigns_col.update_one(
        {"_id": ObjectId(campaign_id)},
        {"$set": {"agent_ids": agent_ids, "updated_at": utcnow()}}
    )
    
    await audit_logs_col.insert_one({
        "action": "assign_campaign_agents",
        "user_id": uid,
        "campaign_id": campaign.get("campaign_id") or campaign_id,
        "count": len(agent_ids),
        "timestamp": utcnow()
    })
    
    await ws_manager.broadcast("global", {"event": "campaigns_updated"})
    return {"status": "success", "agent_ids": agent_ids}


@router.get("/{campaign_id}/stats", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def get_campaign_stats(campaign_id: str, user: dict = Depends(get_current_user)):
    campaign = await campaigns_col.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
        
    uid = user.get("id") or str(user["_id"])
    if user["role"] == Role.TEAM_LEADER and campaign.get("supervisor_id") != uid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden: you can view only your assigned campaigns")
        
    cmp_custom_id = campaign.get("campaign_id")
    cmp_str_id = str(campaign["_id"])
    lead_query = {"$or": [{"campaign_id": cmp_custom_id}, {"campaign_id": cmp_str_id}]}
    
    total_leads = await leads_col.count_documents(lead_query)
    pending_leads = await leads_col.count_documents({**lead_query, "status": {"$in": ["new", "in_progress"]}})
    completed_leads = await leads_col.count_documents({**lead_query, "status": {"$in": ["qualified", "not_interested", "closed"]}})
    
    interested = await leads_col.count_documents({**lead_query, "status": "qualified"})
    not_interested = await leads_col.count_documents({**lead_query, "status": "not_interested"})
    callback = await leads_col.count_documents({**lead_query, "status": "follow_up"})
    
    success_rate = round((interested / total_leads) * 100, 2) if total_leads else 0.0
    
    return {
        "campaign_id": campaign_id,
        "total_leads": total_leads,
        "pending_leads": pending_leads,
        "completed_leads": completed_leads,
        "interested": interested,
        "not_interested": not_interested,
        "callback_scheduled": callback,
        "qualified": interested,
        "converted": interested,
        "retry_queue": not_interested,
        "success_rate": success_rate
    }


@router.post("/{campaign_id}/retry", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def retry_campaign_failed_calls(campaign_id: str, user: dict = Depends(get_current_user)):
    campaign = await campaigns_col.find_one({"_id": ObjectId(campaign_id)})
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
        
    uid = user.get("id") or str(user["_id"])
    if user["role"] == Role.TEAM_LEADER and campaign.get("supervisor_id") != uid:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden: you can retry only your assigned campaigns")
        
    cmp_custom_id = campaign.get("campaign_id")
    cmp_str_id = str(campaign["_id"])
    lead_query = {
        "$or": [{"campaign_id": cmp_custom_id}, {"campaign_id": cmp_str_id}],
        "status": "not_interested"
    }
    
    res = await leads_col.update_many(lead_query, {"$set": {"status": "new", "updated_at": utcnow()}})
    
    await audit_logs_col.insert_one({
        "action": "retry_failed_leads",
        "user_id": uid,
        "campaign_id": campaign.get("campaign_id") or campaign_id,
        "reset_count": res.modified_count,
        "timestamp": utcnow()
    })
    
    await ws_manager.broadcast("global", {"event": "leads_updated"})
    return {"status": "success", "reset_count": res.modified_count}
