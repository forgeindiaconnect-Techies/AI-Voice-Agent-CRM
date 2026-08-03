import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status
from bson import ObjectId
from app.core.database import calls_col, leads_col, users_col, audit_logs_col
from app.core.utils import utcnow, oid_str
from app.core.deps import require_roles, get_current_user
from app.schemas.common import (
    CallStart,
    CallEnd,
    MonitorAction,
    MonitorActionPayload,
    Role,
    CallQualityEvaluation,
    ManualDialPayload,
    ManualCallActionPayload,
    ManualCallTransferPayload,
    ManualDTMFPayload,
    ManualConferencePayload,
)
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/api/calls", tags=["calls"])


def _uid(user: dict) -> str:
    return user.get("id") or str(user["_id"])


@router.post("/start", dependencies=[Depends(require_roles(Role.AGENT))])
async def start_call(payload: CallStart, user: dict = Depends(get_current_user)):
    lead = await leads_col.find_one({"_id": ObjectId(payload.lead_id)})
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    doc = {
        "lead_id": payload.lead_id,
        "agent_id": _uid(user),
        "pool_id": lead["pool_id"],
        "direction": payload.direction,
        "status": "live",
        "started_at": utcnow(),
    }
    result = await calls_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    await leads_col.update_one({"_id": ObjectId(payload.lead_id)}, {"$set": {"status": "in_progress"}})
    await ws_manager.broadcast(lead["pool_id"], {
        "event": "call_started", "call_id": str(doc["_id"]), "lead_name": lead["name"], "agent_id": _uid(user),
    })
    return oid_str(doc)


@router.post("/end", dependencies=[Depends(require_roles(Role.AGENT))])
async def end_call(payload: CallEnd):
    call = await calls_col.find_one({"_id": ObjectId(payload.call_id)})
    if not call:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Call not found")
    update = {
        "status": "completed",
        "outcome": payload.outcome,
        "duration_seconds": payload.duration_seconds,
        "notes": payload.notes,
        "ai_summary": payload.ai_summary,
        "transcript": payload.transcript,
        "ended_at": utcnow(),
    }
    await calls_col.update_one({"_id": ObjectId(payload.call_id)}, {"$set": update})
    await ws_manager.broadcast(call["pool_id"], {"event": "call_ended", "call_id": payload.call_id})
    return {"status": "completed"}


@router.get("")
async def list_calls(user: dict = Depends(get_current_user), pool_id: str | None = None,
                      agent_id: str | None = None, status_filter: str | None = None):
    query = {}
    if user["role"] == Role.AGENT:
        query["agent_id"] = _uid(user)
    elif user["role"] == Role.TEAM_LEADER:
        assigned_agents = await users_col.find({"supervisor_id": _uid(user), "role": Role.AGENT}).to_list(length=1000)
        agent_ids = [str(a["_id"]) for a in assigned_agents]
        query["agent_id"] = {"$in": agent_ids}
        
    if pool_id:
        query["pool_id"] = pool_id
    if agent_id:
        query["agent_id"] = agent_id
    if status_filter:
        query["status"] = status_filter
        
    calls = []
    async for c in calls_col.find(query).sort("started_at", -1).limit(500):
        calls.append(oid_str(c))
    return calls


@router.get("/live", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def live_calls(pool_id: str | None = None, user: dict = Depends(get_current_user)):
    query = {"status": "live"}
    if pool_id:
        query["pool_id"] = pool_id
    if user["role"] == Role.TEAM_LEADER:
        assigned_agents = await users_col.find({"supervisor_id": _uid(user), "role": Role.AGENT}).to_list(length=1000)
        agent_ids = [str(a["_id"]) for a in assigned_agents]
        query["agent_id"] = {"$in": agent_ids}
        
    calls = []
    async for c in calls_col.find(query):
        calls.append(oid_str(c))
    return calls


@router.post("/{call_id}/monitor", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def monitor_call(
    call_id: str,
    action: MonitorAction | None = Query(None),
    payload: MonitorActionPayload | None = Body(None),
    user: dict = Depends(get_current_user)
):
    """Signals a listen/whisper/barge/transfer action on a live call over the pool's websocket channel."""
    act_str = payload.action if payload and payload.action else action
    if not act_str:
        act_str = MonitorAction.LISTEN

    query = {"_id": ObjectId(call_id)} if ObjectId.is_valid(call_id) else {"id": call_id}
    call = await calls_col.find_one(query)
    if not call:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Call not found")
        
    # Security scope check for Team Leader
    if user["role"] == Role.TEAM_LEADER:
        agent_q = {"_id": ObjectId(call["agent_id"])} if ObjectId.is_valid(call["agent_id"]) else {"id": call["agent_id"]}
        agent = await users_col.find_one(agent_q)
        if not agent or agent.get("supervisor_id") != _uid(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden: you can monitor only your assigned team calls")
            
    await calls_col.update_one(
        query,
        {"$push": {"monitor_events": {"action": act_str, "by": _uid(user), "at": utcnow()}}},
    )
    await ws_manager.broadcast(call.get("pool_id", "global"), {
        "event": "monitor_action", "call_id": call_id, "action": act_str, "supervisor_id": _uid(user),
    })
    return {"status": "signal_sent", "action": act_str}


@router.post("/{call_id}/quality", dependencies=[Depends(require_roles(Role.TEAM_LEADER, Role.ADMIN))])
async def evaluate_call_quality(call_id: str, payload: CallQualityEvaluation, user: dict = Depends(get_current_user)):
    """Allows supervisors to audit completed calls, scoring AI attributes, compliance thresholds and adding notes."""
    call = await calls_col.find_one({"_id": ObjectId(call_id)})
    if not call:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Call not found")
        
    # Security scope check for Team Leader
    if user["role"] == Role.TEAM_LEADER:
        agent = await users_col.find_one({"_id": ObjectId(call["agent_id"])})
        if not agent or agent.get("supervisor_id") != _uid(user):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden: you can evaluate only your assigned agents' calls")
            
    await calls_col.update_one(
        {"_id": ObjectId(call_id)},
        {"$set": {
            "quality_evaluation": {
                "coaching_notes": payload.coaching_notes,
                "ai_quality_score": payload.ai_quality_score,
                "compliance_score": payload.compliance_score,
                "sentiment": payload.sentiment,
                "evaluated_by": _uid(user),
                "evaluated_at": utcnow()
            }
        }}
    )
    
    # Audit log
    await audit_logs_col.insert_one({
        "action": "evaluate_call_quality",
        "user_id": _uid(user),
        "target_user_id": call["agent_id"],
        "call_id": call_id,
        "timestamp": utcnow()
    })
    
    return {"status": "success"}


from pydantic import BaseModel

class OutboundSimulationPayload(BaseModel):
    lead_id: str
    campaign_id: str
    intent: str  # "interested", "not_interested", "human_transfer"

class InboundSimulationPayload(BaseModel):
    pool_id: str
    phone: str
    name: str
    require_agent: bool

@router.post("/simulate/outbound")
async def simulate_outbound(payload: OutboundSimulationPayload):
    lead = await leads_col.find_one({"_id": ObjectId(payload.lead_id)})
    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
        
    campaign = await campaigns_col.find_one({"_id": ObjectId(payload.campaign_id)})
    if not campaign:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Campaign not found")
        
    if payload.intent == "interested":
        await leads_col.update_one({"_id": ObjectId(payload.lead_id)}, {"$set": {"status": "qualified"}})
        doc = {
            "lead_id": payload.lead_id,
            "campaign_id": payload.campaign_id,
            "pool_id": lead["pool_id"],
            "direction": "outbound",
            "status": "completed",
            "outcome": "qualified",
            "duration_seconds": 68,
            "started_at": utcnow(),
            "ended_at": utcnow(),
            "ai_summary": "Auto-dialer connected. AI Agent detected high intent of interest in card features.",
            "transcript": "AI Agent: Hello, this is Forge AI Calling. Are you looking to upgrade your card?\nCustomer: Yes, I want a zero-annual fee card.\nAI Agent: Perfect. I am qualifying your lead entry."
        }
        result = await calls_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        await ws_manager.broadcast("global", {"event": "leads_updated"})
        return oid_str(doc)
        
    elif payload.intent == "not_interested":
        await leads_col.update_one({"_id": ObjectId(payload.lead_id)}, {"$set": {"status": "not_interested"}})
        doc = {
            "lead_id": payload.lead_id,
            "campaign_id": payload.campaign_id,
            "pool_id": lead["pool_id"],
            "direction": "outbound",
            "status": "completed",
            "outcome": "not_interested",
            "duration_seconds": 25,
            "started_at": utcnow(),
            "ended_at": utcnow(),
            "ai_summary": "Auto-dialer connected. Customer stated they are not interested. Call closed.",
            "transcript": "AI Agent: Hello from Forge AI Calling. Interested in card upgrades?\nCustomer: No, do not call me again."
        }
        result = await calls_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        await ws_manager.broadcast("global", {"event": "leads_updated"})
        return oid_str(doc)
        
    elif payload.intent == "human_transfer":
        agent = await users_col.find_one({"role": Role.AGENT, "pool_id": lead["pool_id"], "status": "online"})
        if not agent:
            agent = await users_col.find_one({"role": Role.AGENT, "status": "online"})
            
        agent_id = str(agent["_id"]) if agent else "AGT84785"
        
        doc = {
            "lead_id": payload.lead_id,
            "campaign_id": payload.campaign_id,
            "pool_id": lead["pool_id"],
            "agent_id": agent_id,
            "direction": "outbound",
            "status": "live",
            "is_ai": False,
            "started_at": utcnow(),
        }
        result = await calls_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        
        await leads_col.update_one({"_id": ObjectId(payload.lead_id)}, {"$set": {"status": "in_progress", "assigned_agent_id": agent_id}})
        await ws_manager.broadcast("global", {"event": "call_started", "call_id": str(doc["_id"]), "lead_name": lead["name"]})
        return oid_str(doc)
        
    return {"status": "ignored"}


@router.post("/simulate/inbound")
async def simulate_inbound(payload: InboundSimulationPayload):
    lead = await leads_col.find_one({"phone": payload.phone})
    if not lead:
        lead_doc = {
            "lead_id": f"LD{utcnow().strftime('%M%S%f')[:5]}",
            "name": payload.name,
            "phone": payload.phone,
            "status": "new",
            "pool_id": payload.pool_id,
            "created_at": utcnow()
        }
        res_lead = await leads_col.insert_one(lead_doc)
        lead_doc["_id"] = res_lead.inserted_id
        lead = lead_doc
        
    lead_id_str = str(lead["_id"])
    
    if not payload.require_agent:
        doc = {
            "lead_id": lead_id_str,
            "pool_id": payload.pool_id,
            "direction": "inbound",
            "status": "completed",
            "outcome": "answered",
            "duration_seconds": 45,
            "started_at": utcnow(),
            "ended_at": utcnow(),
            "ai_summary": "Inbound IVR Menu option selected. Customer discussed support credentials. Resolved by AI.",
            "transcript": "Customer: Hi, I need support details.\nAI Agent: Yes, select recruitment or card services. Supported.\nCustomer: Thank you, resolved."
        }
        result = await calls_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        await ws_manager.broadcast("global", {"event": "leads_updated"})
        return oid_str(doc)
        
    else:
        agent = await users_col.find_one({"role": Role.AGENT, "pool_id": payload.pool_id, "status": "online"})
        if not agent:
            agent = await users_col.find_one({"role": Role.AGENT, "status": "online"})
            
        agent_id = str(agent["_id"]) if agent else "AGT84785"
        
        doc = {
            "lead_id": lead_id_str,
            "pool_id": payload.pool_id,
            "agent_id": agent_id,
            "direction": "inbound",
            "status": "live",
            "is_ai": False,
            "started_at": utcnow(),
        }
        result = await calls_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        
        await leads_col.update_one({"_id": ObjectId(lead_id_str)}, {"$set": {"status": "in_progress", "assigned_agent_id": agent_id}})
        await ws_manager.broadcast("global", {"event": "call_started", "call_id": str(doc["_id"]), "lead_name": payload.name})
        return oid_str(doc)


@router.get("/inbound/summary", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
async def get_inbound_calls_summary(user: dict = Depends(get_current_user)):
    departments = ["recruitment", "credit_card_sales", "customer_support"]
    results = {}
    
    for dept in departments:
        active = await calls_col.count_documents({"direction": "inbound", "status": "live", "pool_id": dept})
        resolved = await calls_col.count_documents({"direction": "inbound", "status": "completed", "outcome": "answered", "pool_id": dept})
        transferred = await calls_col.count_documents({"direction": "inbound", "status": "completed", "outcome": "transferred", "pool_id": dept})
        missed = await calls_col.count_documents({"direction": "inbound", "status": "completed", "outcome": "missed", "pool_id": dept})
        waiting = await leads_col.count_documents({"pool_id": dept, "status": "new"})
        agents = await users_col.count_documents({"role": "agent", "pool_id": dept, "status": "online"})
        
        avg_wait = 8 if dept == "recruitment" else (14 if dept == "credit_card_sales" else 11)
        sla = 98.2 if dept == "recruitment" else (94.5 if dept == "credit_card_sales" else 96.8)
        
        results[dept] = {
            "department": dept,
            "active_calls": active,
            "resolved_calls": resolved,
            "transferred_calls": transferred,
            "missed_calls": missed,
            "waiting_queue": waiting,
            "available_agents": agents,
            "average_wait_seconds": avg_wait,
            "sla_percentage": sla,
            "status": "stable" if waiting < 10 else "busy"
        }
        
    return results


# --- MANUAL DIAL FEATURES ---

active_call_streams = {}


async def simulate_call_stream(call_id: str, pool_id: str):
    transcript_dialogue = [
        ("customer", "Hello? Yes, I was looking for some assistance regarding my query."),
        ("agent", "Welcome to Forge India Connect! I can certainly help you. May I know what department you're trying to reach?"),
        ("customer", "I want to follow up on the status of my request. It has been pending since last week."),
        ("agent", "I see. Let me pull up your account information using your registered phone number."),
        ("customer", "Perfect. Let know what information you need from my end."),
        ("agent", "Thank you. I have retrieved your records. I see that your request is currently in review by our verification team."),
        ("customer", "Oh, okay. How long will it take to complete the review?"),
        ("agent", "It typically takes 2-3 business days. I will escalate this to high priority so that it gets processed sooner."),
        ("customer", "That would be wonderful. Thank you so much for the quick help!"),
        ("agent", "You're welcome! Is there anything else I can assist you with today?"),
        ("customer", "No, that's all. Have a great day!"),
        ("agent", "Thank you for calling Forge India Connect. Goodbye!"),
    ]
    
    ai_suggestions_list = [
        "Acknowledge customer's request and verify their phone details.",
        "Check lead status in CRM and provide precise estimation.",
        "Offer to escalate the ticket priority for faster processing.",
        "Confirm if they have any other questions regarding recruitment/sales/support.",
        "End the call professionally and save the disposition status."
    ]
    
    sentiments = ["neutral", "neutral", "neutral", "neutral", "neutral", "positive", "positive", "positive", "positive"]

    try:
        await asyncio.sleep(4)
        current_transcript = []
        
        for idx, (speaker, text) in enumerate(transcript_dialogue):
            call = await calls_col.find_one({"_id": ObjectId(call_id)})
            if not call or call.get("status") != "live":
                break
                
            while call and call.get("call_state") == "hold":
                await asyncio.sleep(2)
                call = await calls_col.find_one({"_id": ObjectId(call_id)})
                if not call or call.get("status") != "live":
                    break
            
            if not call or call.get("status") != "live":
                break
                
            current_transcript.append({
                "speaker": speaker,
                "text": text,
                "timestamp": utcnow().isoformat()
            })
            
            sugg_idx = min(idx // 2, len(ai_suggestions_list) - 1)
            sent_idx = min(idx, len(sentiments) - 1)
            
            current_suggestions = ai_suggestions_list[:sugg_idx + 1]
            current_sentiment = sentiments[sent_idx]
            
            update_payload = {
                "event": "manual_call_update",
                "call_id": call_id,
                "transcript": current_transcript,
                "ai_suggestions": current_suggestions,
                "sentiment": current_sentiment
            }
            
            await calls_col.update_one(
                {"_id": ObjectId(call_id)},
                {"$set": {
                    "transcript_list": current_transcript,
                    "sentiment": current_sentiment,
                    "ai_suggestions": current_suggestions
                }}
            )
            
            await ws_manager.broadcast("global", update_payload)
            await ws_manager.broadcast(pool_id, update_payload)
            
            await asyncio.sleep(4.5)
            
    except asyncio.CancelledError:
        pass
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").error(f"Error in simulate_call_stream: {e}")


@router.post("/manual-dial", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
async def start_manual_dial(payload: ManualDialPayload, user: dict = Depends(get_current_user)):
    import re
    cleaned = str(payload.phone).strip()
    is_plus = cleaned.startswith("+")
    digits = re.sub(r"\D", "", cleaned)
    normalized_phone = f"+{digits}" if is_plus else digits
    
    if not normalized_phone:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid phone number provided")
        
    lead = await leads_col.find_one({"phone": normalized_phone, "pool_id": payload.pool_id})
    if not lead:
        from app.core.utils import gen_lead_id
        lead_doc = {
            "lead_id": gen_lead_id(),
            "name": payload.name or "Unknown Customer",
            "phone": normalized_phone,
            "status": "in_progress",
            "pool_id": payload.pool_id,
            "created_at": utcnow(),
            "created_by": _uid(user)
        }
        res_lead = await leads_col.insert_one(lead_doc)
        lead_doc["_id"] = res_lead.inserted_id
        lead = lead_doc
    else:
        await leads_col.update_one(
            {"_id": lead["_id"]},
            {"$set": {"status": "in_progress", "name": payload.name or lead["name"]}}
        )
        
    lead_id_str = str(lead["_id"])
    
    assigned_agent_id = _uid(user)
    if payload.agent_assign_mode == "manual" and payload.assigned_agent_id:
        target_agent = await users_col.find_one({"_id": ObjectId(payload.assigned_agent_id)})
        if not target_agent:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Target agent not found")
        assigned_agent_id = str(target_agent["_id"])
    elif payload.agent_assign_mode == "auto":
        online_agent = await users_col.find_one({"role": Role.AGENT, "pool_id": payload.pool_id, "status": "online"})
        if online_agent:
            assigned_agent_id = str(online_agent["_id"])
            
    sip_logs = [
        f"[{utcnow().isoformat()}] [SIP] INVITE sip:{payload.pool_id}@forge-pbx.local SIP/2.0",
        f"[{utcnow().isoformat()}] [SIP] From: <sip:{normalized_phone}@sip-carrier.net>;tag=as312df5",
        f"[{utcnow().isoformat()}] [SIP] To: <sip:{payload.pool_id}@forge-pbx.local>",
        f"[{utcnow().isoformat()}] [SIP] Sending: SIP/2.0 100 Trying",
        f"[{utcnow().isoformat()}] [PBX] Route matched: Department queue '{payload.pool_id.upper()}'",
        f"[{utcnow().isoformat()}] [PBX] Trunk routing -> Asterisk Trunk: trunk-inbound-manual",
        f"[{utcnow().isoformat()}] [PBX] Extension matched: inbound_queue_{payload.pool_id}",
        f"[{utcnow().isoformat()}] [SIP] Sending: SIP/2.0 180 Ringing",
        f"[{utcnow().isoformat()}] [AI] Initializing speech pipelines (Whisper-ASR, Gemini-LLM, TTS)",
        f"[{utcnow().isoformat()}] [AI] Preferred Language: {payload.language.upper()} pipeline active",
        f"[{utcnow().isoformat()}] [SIP] Sending: SIP/2.0 200 OK (SDP handshake established)",
        f"[{utcnow().isoformat()}] [AI] Voice Agent Connected & listening..."
    ]
    
    doc = {
        "lead_id": lead_id_str,
        "pool_id": payload.pool_id,
        "agent_id": assigned_agent_id,
        "direction": "inbound",
        "status": "live",
        "call_state": "active",
        "muted": False,
        "priority": payload.priority,
        "language": payload.language,
        "notes": payload.notes or "",
        "sip_logs": sip_logs,
        "transcript_list": [],
        "ai_suggestions": [],
        "sentiment": "neutral",
        "recording_status": "recording",
        "recording_file": f"C:/recordings/manual_{lead_id_str}_{int(utcnow().timestamp())}.wav",
        "started_at": utcnow(),
    }
    
    result = await calls_col.insert_one(doc)
    doc["_id"] = result.inserted_id
    call_id_str = str(doc["_id"])
    
    await leads_col.update_one(
        {"_id": lead["_id"]},
        {"$set": {"assigned_agent_id": assigned_agent_id}}
    )
    
    task = asyncio.create_task(simulate_call_stream(call_id_str, payload.pool_id))
    active_call_streams[call_id_str] = task
    
    await audit_logs_col.insert_one({
        "action": "start_manual_dial",
        "user_id": _uid(user),
        "lead_id": lead_id_str,
        "call_id": call_id_str,
        "timestamp": utcnow()
    })
    
    ws_payload = {
        "event": "call_started",
        "call_id": call_id_str,
        "lead_name": lead["name"],
        "agent_id": assigned_agent_id,
        "pool_id": payload.pool_id,
        "direction": "inbound",
        "is_manual": True,
        "sip_logs": sip_logs
    }
    await ws_manager.broadcast("global", ws_payload)
    await ws_manager.broadcast(payload.pool_id, ws_payload)
    
    return oid_str(doc)


@router.post("/{call_id}/manual-action", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
async def manual_call_action(call_id: str, payload: ManualCallActionPayload, user: dict = Depends(get_current_user)):
    call = await calls_col.find_one({"_id": ObjectId(call_id)})
    if not call:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Call not found")
        
    action = payload.action.lower()
    if action not in ["mute", "hold", "resume"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid action. Must be mute, hold, or resume")
        
    update_fields = {}
    sip_msg = ""
    if action == "mute":
        update_fields["muted"] = True
        sip_msg = f"[{utcnow().isoformat()}] [SIP] Call muted by agent"
    elif action == "hold":
        update_fields["call_state"] = "hold"
        sip_msg = f"[{utcnow().isoformat()}] [SIP] Call placed on hold (SIP INVITE with a=sendonly)"
    elif action == "resume":
        update_fields["call_state"] = "active"
        update_fields["muted"] = False
        sip_msg = f"[{utcnow().isoformat()}] [SIP] Call resumed (SIP INVITE with a=sendrecv)"
        
    await calls_col.update_one(
        {"_id": ObjectId(call_id)},
        {"$set": update_fields, "$push": {"sip_logs": sip_msg}}
    )
    
    await audit_logs_col.insert_one({
        "action": f"call_{action}",
        "user_id": _uid(user),
        "call_id": call_id,
        "timestamp": utcnow()
    })
    
    ws_payload = {
        "event": "manual_call_action",
        "call_id": call_id,
        "action": action,
        "sip_message": sip_msg
    }
    await ws_manager.broadcast("global", ws_payload)
    await ws_manager.broadcast(call["pool_id"], ws_payload)
    
    return {"status": "success", "action": action}


@router.post("/{call_id}/manual-transfer", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
async def manual_call_transfer(call_id: str, payload: ManualCallTransferPayload, user: dict = Depends(get_current_user)):
    call = await calls_col.find_one({"_id": ObjectId(call_id)})
    if not call:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Call not found")
        
    target_user = await users_col.find_one({"_id": ObjectId(payload.target_agent_id)})
    if not target_user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Target agent or supervisor not found")
        
    new_agent_id = str(target_user["_id"])
    sip_msg = f"[{utcnow().isoformat()}] [SIP] Initiating Call Transfer (SIP REFER to agent {target_user['name']})"
    sip_msg_ok = f"[{utcnow().isoformat()}] [SIP] Transfer successful. Connected agent: {target_user['name']}"
    
    await calls_col.update_one(
        {"_id": ObjectId(call_id)},
        {
            "$set": {"agent_id": new_agent_id},
            "$push": {"sip_logs": {"$each": [sip_msg, sip_msg_ok]}}
        }
    )
    
    await leads_col.update_one(
        {"_id": ObjectId(call["lead_id"])},
        {"$set": {"assigned_agent_id": new_agent_id}}
    )
    
    await audit_logs_col.insert_one({
        "action": "call_transfer",
        "user_id": _uid(user),
        "target_user_id": new_agent_id,
        "call_id": call_id,
        "timestamp": utcnow()
    })
    
    ws_payload = {
        "event": "manual_call_transferred",
        "call_id": call_id,
        "from_agent_id": _uid(user),
        "to_agent_id": new_agent_id,
        "to_agent_name": target_user["name"],
        "sip_message": sip_msg_ok
    }
    await ws_manager.broadcast("global", ws_payload)
    await ws_manager.broadcast(call["pool_id"], ws_payload)
    
    return {"status": "success", "transferred_to": target_user["name"]}


@router.post("/{call_id}/manual-end", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
async def end_manual_call(call_id: str, payload: CallEnd, user: dict = Depends(get_current_user)):
    call = await calls_col.find_one({"_id": ObjectId(call_id)})
    if not call:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Call not found")
        
    task = active_call_streams.pop(call_id, None)
    if task:
        task.cancel()
        
    sip_msg = f"[{utcnow().isoformat()}] [SIP] Connection terminated (SIP BYE received)"
    
    transcript_text = payload.transcript or ""
    if not transcript_text and call.get("transcript_list"):
        transcript_text = "\n".join([f"{t['speaker'].capitalize()}: {t['text']}" for t in call["transcript_list"]])
        
    ai_summary = payload.ai_summary
    if not ai_summary:
        ai_summary = "Manual Dial call successfully connected to recipient. Discussed query and updated details in CRM."
        
    update = {
        "status": "completed",
        "outcome": payload.outcome,
        "duration_seconds": payload.duration_seconds,
        "notes": payload.notes or call.get("notes", ""),
        "ai_summary": ai_summary,
        "transcript": transcript_text,
        "recording_status": "saved",
        "ended_at": utcnow()
    }
    
    await calls_col.update_one(
        {"_id": ObjectId(call_id)},
        {
            "$set": update,
            "$push": {"sip_logs": sip_msg}
        }
    )
    
    lead_status = "new"
    if payload.outcome in ["qualified", "answered"]:
        lead_status = "qualified"
    elif payload.outcome == "not_interested":
        lead_status = "not_interested"
    elif payload.outcome == "follow_up_required":
        lead_status = "follow_up"
        
    await leads_col.update_one(
        {"_id": ObjectId(call["lead_id"])},
        {"$set": {"status": lead_status}}
    )
    
    await audit_logs_col.insert_one({
        "action": "end_manual_dial",
        "user_id": _uid(user),
        "call_id": call_id,
        "outcome": payload.outcome,
        "timestamp": utcnow()
    })
    
    ws_payload = {
        "event": "call_ended",
        "call_id": call_id,
        "outcome": payload.outcome,
        "pool_id": call["pool_id"]
    }
    await ws_manager.broadcast("global", ws_payload)
    await ws_manager.broadcast(call["pool_id"], ws_payload)
    
    return {"status": "completed"}


@router.post("/{call_id}/dtmf", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
async def send_dtmf_digit(call_id: str, payload: ManualDTMFPayload, user: dict = Depends(get_current_user)):
    call = await calls_col.find_one({"_id": ObjectId(call_id)})
    if not call:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Call not found")
        
    digit = payload.digit
    if digit not in ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid DTMF digit")
        
    sip_msg = f"[{utcnow().isoformat()}] [SIP] DTMF digit '{digit}' received (RFC 4733 / RFC 2833)"
    
    await calls_col.update_one(
        {"_id": ObjectId(call_id)},
        {"$push": {"sip_logs": sip_msg}}
    )
    
    ws_payload = {
        "event": "manual_call_action",
        "call_id": call_id,
        "action": "dtmf",
        "digit": digit,
        "sip_message": sip_msg
    }
    await ws_manager.broadcast("global", ws_payload)
    await ws_manager.broadcast(call["pool_id"], ws_payload)
    
    return {"status": "success", "digit": digit}


@router.post("/{call_id}/conference", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
async def manual_call_conference(call_id: str, payload: ManualConferencePayload, user: dict = Depends(get_current_user)):
    call = await calls_col.find_one({"_id": ObjectId(call_id)})
    if not call:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Call not found")
        
    invitee = await users_col.find_one({"_id": ObjectId(payload.invitee_agent_id)})
    if not invitee:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invitee user not found")
        
    sip_msg = f"[{utcnow().isoformat()}] [SIP] SIP INVITE sent to join bridge conference-9087 (Invitee: {invitee['name']})"
    sip_msg_ok = f"[{utcnow().isoformat()}] [SIP] Invitee {invitee['name']} joined conference bridge"
    
    await calls_col.update_one(
        {"_id": ObjectId(call_id)},
        {
            "$set": {"is_conference": True},
            "$push": {
                "sip_logs": {"$each": [sip_msg, sip_msg_ok]},
                "conference_agents": payload.invitee_agent_id
            }
        }
    )
    
    await audit_logs_col.insert_one({
        "action": "call_conference_add",
        "user_id": _uid(user),
        "invitee_user_id": payload.invitee_agent_id,
        "call_id": call_id,
        "timestamp": utcnow()
    })
    
    ws_payload = {
        "event": "manual_call_action",
        "call_id": call_id,
        "action": "conference",
        "invitee_name": invitee["name"],
        "sip_message": sip_msg_ok
    }
    await ws_manager.broadcast("global", ws_payload)
    await ws_manager.broadcast(call["pool_id"], ws_payload)
    
    return {"status": "success", "conference_established_with": invitee["name"]}


