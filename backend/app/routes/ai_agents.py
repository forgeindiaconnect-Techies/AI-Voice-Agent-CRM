from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from app.core.database import ai_agents_col, audit_logs_col
from app.core.utils import gen_ai_agent_id, utcnow, oid_str
from app.core.deps import require_roles, get_current_user
from app.schemas.common import AIAgentCreate, AIAgentUpdate, Role
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/api/ai-agents", tags=["ai_agents"])

# Seed initial AI Agents if collection is empty
INITIAL_AI_AGENTS = [
    {
        "agent_id": "AI-84721",
        "name": "Aria — Credit Card Sales Bot",
        "voice_model": "Neural-Female-IN",
        "language": "English (IN)",
        "status": "online",
        "is_active": True,
        "system_prompt": "You are Aria, an energetic sales agent for Forge India Connect specializing in credit card offers.",
        "concurrency_limit": 10,
        "temperature": 0.7,
        "max_call_duration_seconds": 300,
        "description": "Outbound sales voice bot tuned for banking & credit card campaigns.",
        "created_at": utcnow(),
        "updated_at": utcnow()
    },
    {
        "agent_id": "AI-84722",
        "name": "Karan — Recruitment Screening Bot",
        "voice_model": "Neural-Male-IN",
        "language": "English (IN)",
        "status": "in_call",
        "is_active": True,
        "system_prompt": "You are Karan, an HR recruitment assistant conducting candidate pre-screening.",
        "concurrency_limit": 5,
        "temperature": 0.6,
        "max_call_duration_seconds": 450,
        "description": "HR screening bot for technical & executive hiring workflows.",
        "created_at": utcnow(),
        "updated_at": utcnow()
    },
    {
        "agent_id": "AI-84723",
        "name": "Ananya — Hindi Support Voice Bot",
        "voice_model": "Neural-Hindi-Female",
        "language": "Hindi",
        "status": "online",
        "is_active": True,
        "system_prompt": "Aap Ananya hain, Forge India Connect ki hindi grahak sewa sahayak.",
        "concurrency_limit": 8,
        "temperature": 0.65,
        "max_call_duration_seconds": 360,
        "description": "Vernacular Hindi customer service bot for inbound & outbound queries.",
        "created_at": utcnow(),
        "updated_at": utcnow()
    }
]


@router.get("")
async def list_ai_agents(
    query: str | None = None,
    status_val: str | None = Query(None, alias="status"),
    is_active: bool | None = None,
    voice_model: str | None = None,
    user: dict = Depends(get_current_user)
):
    """Fetch list of AI agents with auto-seeding if collection is empty."""
    count = await ai_agents_col.count_documents({})
    if count == 0:
        await ai_agents_col.insert_many(INITIAL_AI_AGENTS)

    filter_dict = {}
    if status_val:
        filter_dict["status"] = status_val
    if is_active is not None:
        filter_dict["is_active"] = is_active
    if voice_model:
        filter_dict["voice_model"] = voice_model

    if query:
        regex_query = {"$regex": query, "$options": "i"}
        filter_dict["$or"] = [
            {"name": regex_query},
            {"agent_id": regex_query},
            {"voice_model": regex_query},
            {"language": regex_query},
            {"description": regex_query}
        ]

    agents = []
    async for doc in ai_agents_col.find(filter_dict).sort("created_at", -1):
        agents.append(oid_str(doc))

    return agents


@router.post("", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def create_ai_agent(payload: AIAgentCreate, user: dict = Depends(get_current_user)):
    """Create a new AI Agent."""
    doc = payload.model_dump()
    doc["agent_id"] = gen_ai_agent_id()
    doc["created_by"] = user.get("id") or str(user.get("_id", ""))
    doc["created_at"] = utcnow()
    doc["updated_at"] = utcnow()

    result = await ai_agents_col.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Audit Log
    await audit_logs_col.insert_one({
        "action": "create_ai_agent",
        "user_id": doc["created_by"],
        "agent_id": doc["agent_id"],
        "name": doc["name"],
        "timestamp": utcnow()
    })

    # Broadcast WebSocket notification
    await ws_manager.broadcast("global", {"event": "ai_agents_updated"})

    return oid_str(doc)


@router.get("/{agent_id}")
async def get_ai_agent(agent_id: str, user: dict = Depends(get_current_user)):
    """Get single AI agent details."""
    query = {"_id": ObjectId(agent_id)} if ObjectId.is_valid(agent_id) else {"agent_id": agent_id}
    doc = await ai_agents_col.find_one(query)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI Agent not found")
    return oid_str(doc)


@router.put("/{agent_id}", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def update_ai_agent(agent_id: str, payload: AIAgentUpdate, user: dict = Depends(get_current_user)):
    """Update AI Agent details."""
    query = {"_id": ObjectId(agent_id)} if ObjectId.is_valid(agent_id) else {"agent_id": agent_id}
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data["updated_at"] = utcnow()

    result = await ai_agents_col.update_one(query, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI Agent not found")

    updated_doc = await ai_agents_col.find_one(query)

    # Broadcast WebSocket update
    await ws_manager.broadcast("global", {"event": "ai_agents_updated"})

    return oid_str(updated_doc)


@router.delete("/{agent_id}", dependencies=[Depends(require_roles(Role.ADMIN))])
async def delete_ai_agent(agent_id: str, user: dict = Depends(get_current_user)):
    """Delete an AI Agent (Admin only)."""
    query = {"_id": ObjectId(agent_id)} if ObjectId.is_valid(agent_id) else {"agent_id": agent_id}
    result = await ai_agents_col.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI Agent not found")

    # Broadcast WebSocket update
    await ws_manager.broadcast("global", {"event": "ai_agents_updated"})

    return {"status": "deleted", "agent_id": agent_id}


@router.patch("/{agent_id}/toggle-status", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def toggle_ai_agent_status(
    agent_id: str,
    status_val: str | None = None,
    is_active: bool | None = None,
    user: dict = Depends(get_current_user)
):
    """Toggle active state or update live operational status."""
    query = {"_id": ObjectId(agent_id)} if ObjectId.is_valid(agent_id) else {"agent_id": agent_id}
    
    update_dict = {"updated_at": utcnow()}
    if status_val is not None:
        update_dict["status"] = status_val
    if is_active is not None:
        update_dict["is_active"] = is_active

    result = await ai_agents_col.update_one(query, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI Agent not found")

    updated_doc = await ai_agents_col.find_one(query)

    # Broadcast WebSocket update
    await ws_manager.broadcast("global", {"event": "ai_agents_updated"})

    return oid_str(updated_doc)
