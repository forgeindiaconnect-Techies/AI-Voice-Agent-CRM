import asyncio
import httpx
import logging
import os
# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Query, Body, status, Request
from fastapi.responses import PlainTextResponse, JSONResponse
# pyrefly: ignore [missing-import]
from bson import ObjectId
from app.core.database import calls_col, leads_col, users_col, audit_logs_col, campaigns_col
from app.core.utils import utcnow, oid_str
from app.core.deps import require_roles, get_current_user
from app.core.http import get_http_client
from app.schemas.common import (
    CallStart,
    CallEnd,
    MonitorAction,
    MonitorActionPayload,
    Role,
    CallQualityEvaluation,
    CallQualityEvaluation,
    ManualDialPayload,
    VapiDialPayload,
    ManualCallActionPayload,
    ManualCallTransferPayload,
    ManualDTMFPayload,
    ManualConferencePayload,
)
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/api/calls", tags=["calls"])


def _safe_oid(oid_val: str | None) -> ObjectId | None:
    if oid_val and isinstance(oid_val, str) and ObjectId.is_valid(oid_val):
        return ObjectId(oid_val)
    return None


def normalize_e164(phone_str: str) -> str:
    cleaned = re.sub(r"\D", "", str(phone_str).strip())
    if not cleaned:
        return ""
    if len(cleaned) == 10:
        return f"+91{cleaned}"
    elif len(cleaned) == 12 and cleaned.startswith("91"):
        return f"+{cleaned}"
    elif str(phone_str).strip().startswith("+"):
        return f"+{cleaned}"
    return f"+{cleaned}"


# pyrefly: ignore [missing-import]
from fastapi import Form
# pyrefly: ignore [missing-import]
from fastapi.responses import PlainTextResponse
# pyrefly: ignore [missing-import]
from twilio.jwt.access_token import AccessToken
# pyrefly: ignore [missing-import]
from twilio.jwt.access_token.grants import VoiceGrant
# pyrefly: ignore [missing-import]
from twilio.twiml.voice_response import VoiceResponse, Dial, Gather
from urllib.parse import quote
import re
from app.core.config import settings

@router.get("/token")
async def get_twilio_token(user: dict = Depends(get_current_user)):
    """Generate a Twilio Voice Access Token for WebRTC browser calling"""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_API_KEY:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Twilio credentials missing")
        
    token = AccessToken(
        settings.TWILIO_ACCOUNT_SID,
        settings.TWILIO_API_KEY,
        settings.TWILIO_API_SECRET,
        identity=_uid(user)
    )
    
    # Needs TWILIO_TWIML_APP_SID in .env
    app_sid = getattr(settings, 'TWILIO_TWIML_APP_SID', '')
    if not app_sid:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "TWILIO_TWIML_APP_SID missing in .env")
        
    voice_grant = VoiceGrant(
        outgoing_application_sid=app_sid,
        incoming_allow=True
    )
    token.add_grant(voice_grant)
    
    return {"token": token.to_jwt()}


@router.api_route("/twiml", methods=["GET", "POST"])
async def get_twiml(request: Request):
    """
    Step 1 TwiML Webhook:
    Executed when Desktop App places a call.
    Plays trial account notification ONLY to the Desktop Agent on WebRTC leg.
    The customer's phone DOES NOT RING AT ALL during this step.
    When the message finishes, Twilio automatically proceeds to /twiml-dial to ring customer.
    """
    if request.method == "POST":
        try:
            form_data = await request.form()
        except Exception:
            form_data = {}
        To = form_data.get("To", "")
    else:
        To = request.query_params.get("To", "")

    if To:
        To = To.replace(" ", "+")

    base_url = getattr(settings, 'BASE_URL', 'https://ai-voice-agent-crm.onrender.com')
    dial_url = f"{base_url}/api/calls/twiml-dial?To={quote(To)}"

    response = VoiceResponse()
    
    # Gather prompt plays ONLY to Desktop Agent. Customer is not dialed yet.
    gather = Gather(
        action=dial_url,
        method="POST",
        num_digits=1,
        timeout=1,
    )
    gather.say("Twilio trial account call. Connecting customer now.", voice="alice")
    response.append(gather)

    # Redirect to dial endpoint once message finishes playing
    response.redirect(dial_url, method="POST")

    return PlainTextResponse(str(response), media_type="text/xml")


@router.api_route("/twiml-dial", methods=["GET", "POST"])
async def get_twiml_dial(request: Request):
    """
    Step 2 TwiML Webhook:
    Executed ONLY AFTER the trial account message finishes playing in Desktop App.
    Now Twilio places the single outbound call to the customer's phone.
    """
    if request.method == "POST":
        try:
            form_data = await request.form()
        except Exception:
            form_data = {}
        To = form_data.get("To", "") or request.query_params.get("To", "")
    else:
        To = request.query_params.get("To", "")

    if To:
        To = To.replace(" ", "+")

    base_url = getattr(settings, 'BASE_URL', 'https://ai-voice-agent-crm.onrender.com')
    status_callback_url = f"{base_url}/api/calls/status-callback"
    twilio_number = getattr(settings, 'TWILIO_PHONE_NUMBER', '')
    caller_id = twilio_number if twilio_number else '+19783818471'

    response = VoiceResponse()

    if To and To != twilio_number:
        dial = Dial(
            caller_id=caller_id,
            action=status_callback_url,
            timeout=30,
        )
        if re.match(r"^[\d\+\-\(\) ]+$", To):
            dial.number(
                To,
                status_callback=status_callback_url,
                status_callback_event="initiated ringing answered completed",
                status_callback_method="POST",
            )
        else:
            dial.client(To)
        response.append(dial)
    else:
        response.say("Welcome to Forge India Connect. Connecting your call.")

    return PlainTextResponse(str(response), media_type="text/xml")


@router.api_route("/status-callback", methods=["GET", "POST"])
async def twilio_status_callback(request: Request):
    """
    Twilio Status Callback webhook.
    Twilio calls this URL to report real-time call status changes:
    - ringing, in-progress (answered), completed, busy, no-answer, failed, canceled
    
    We broadcast the status over WebSocket so the frontend softphone
    updates its UI INSTANTLY without any artificial delays or polling.
    """
    try:
        if request.method == "POST":
            try:
                form_data = await request.form()
            except Exception:
                form_data = {}
        else:
            form_data = request.query_params

        call_sid = form_data.get("CallSid", "")
        call_status = form_data.get("CallStatus", "")  # e.g. ringing, in-progress, busy, no-answer, failed, completed
        call_duration = form_data.get("CallDuration", "0")
        to_number = form_data.get("To", "")
        from_number = form_data.get("From", "")

        # Release active call lock if call reached terminal state
        if call_status.lower() in ["completed", "busy", "no-answer", "failed", "canceled"]:
            release_call_lock(phone=to_number, call_id=call_sid)

        # Broadcast to all connected WebSocket clients globally
        await ws_manager.broadcast_global({
            "event": "call_status_update",
            "call_sid": call_sid,
            "call_status": call_status,
            "duration": call_duration,
            "to": to_number,
            "from": from_number,
        })

    except Exception as e:
        print(f"[status-callback] Error: {e}")

    return PlainTextResponse("OK", media_type="text/plain")


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
    release_call_lock(agent_id=call.get("agent_id"), call_id=payload.call_id)
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
        if not c.get("phone") and c.get("lead_id"):
            lead_id_val = str(c.get("lead_id"))
            lead = None
            if ObjectId.is_valid(lead_id_val):
                lead = await leads_col.find_one({"_id": ObjectId(lead_id_val)})
            if not lead:
                lead = await leads_col.find_one({"lead_id": lead_id_val}) or await leads_col.find_one({"phone": lead_id_val})
            if lead:
                c["phone"] = lead.get("phone", "")
                c["lead_name"] = lead.get("name", "")

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
        # Fetch related data
        lead = await leads_col.find_one({"_id": ObjectId(c.get("lead_id"))}) if c.get("lead_id") and ObjectId.is_valid(c.get("lead_id")) else None
        agent = await users_col.find_one({"_id": ObjectId(c.get("agent_id"))}) if c.get("agent_id") and ObjectId.is_valid(c.get("agent_id")) else None
        
        # We need to map to what the frontend expects
        c["customer_name"] = lead.get("name") if lead else "Unknown Customer"
        c["phone_number"] = lead.get("phone") if lead else "Unknown Phone"
        c["formatted_lead_id"] = lead.get("lead_id") if lead else "UNKNOWN"
        c["location"] = lead.get("location") if lead else ""
        c["language"] = c.get("language") or (lead.get("language") if lead else "English")
        c["priority"] = c.get("priority") or (lead.get("priority") if lead else "medium")
        
        c["agent_name"] = agent.get("name") if agent else "Unassigned"
        c["agent_role"] = agent.get("department") or "Voice Specialist" if agent else ""
        
        # Provide default simulated values for missing fields to satisfy the UI
        c["pool_name"] = "Department Pool" # Or fetch from pools_col if we want to
        c["queue_name"] = "Standard Queue"
        c["campaign_name"] = "General Campaign"
        c["sentiment"] = c.get("sentiment") or "Neutral"
        c["sentiment_score"] = 50
        
        # Calculate timer_seconds if started_at exists
        if "started_at" in c and c["started_at"]:
            delta = utcnow().replace(tzinfo=None) - c["started_at"].replace(tzinfo=None)
            c["timer_seconds"] = int(delta.total_seconds())
        else:
            c["timer_seconds"] = 0
            
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
            
    update_op = {"$push": {"monitor_events": {"action": act_str, "by": _uid(user), "at": utcnow()}}}
    if act_str == "end":
        update_op["$set"] = {"status": "completed", "ended_at": utcnow(), "outcome": "terminated_by_supervisor"}
        
    await calls_col.update_one(
        query,
        update_op
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


# pyrefly: ignore [missing-import]
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

import time

active_call_streams = {}
active_call_locks = {}
processed_idempotency_keys = {}

LOCK_TTL_SECONDS = 120
IDEMPOTENCY_TTL_SECONDS = 30


def _cleanup_expired_locks():
    now = time.time()
    expired_locks = [k for k, v in active_call_locks.items() if now - v.get("timestamp", 0) > LOCK_TTL_SECONDS]
    for k in expired_locks:
        active_call_locks.pop(k, None)

    expired_keys = [k for k, v in processed_idempotency_keys.items() if now - v.get("timestamp", 0) > IDEMPOTENCY_TTL_SECONDS]
    for k in expired_keys:
        processed_idempotency_keys.pop(k, None)


def acquire_call_lock(phone: str, agent_id: str, idempotency_key: str | None = None) -> tuple[bool, str]:
    _cleanup_expired_locks()
    now = time.time()

    if idempotency_key and idempotency_key in processed_idempotency_keys:
        return False, "IDEMPOTENCY_HIT"

    if phone in active_call_locks:
        lock_info = active_call_locks[phone]
        if now - lock_info.get("timestamp", 0) < LOCK_TTL_SECONDS:
            return False, f"Call already in progress to {phone}"

    if agent_id and agent_id in active_call_locks:
        lock_info = active_call_locks[agent_id]
        if now - lock_info.get("timestamp", 0) < LOCK_TTL_SECONDS:
            return False, "Agent already has an active call session"

    return True, ""


def register_call_lock(phone: str, agent_id: str, call_id: str, idempotency_key: str | None = None, result_doc: dict | None = None):
    now = time.time()
    lock_data = {"call_id": call_id, "idempotency_key": idempotency_key, "timestamp": now}
    active_call_locks[phone] = lock_data
    if agent_id:
        active_call_locks[agent_id] = lock_data
    if idempotency_key and result_doc:
        processed_idempotency_keys[idempotency_key] = {"result": result_doc, "timestamp": now}


def release_call_lock(phone: str | None = None, agent_id: str | None = None, call_id: str | None = None):
    _cleanup_expired_locks()
    keys_to_remove = []
    for k, v in active_call_locks.items():
        if (phone and (k == phone or k.replace("+", "") == phone.replace("+", ""))) or (agent_id and k == agent_id) or (call_id and v.get("call_id") == call_id):
            keys_to_remove.append(k)
    for k in keys_to_remove:
        active_call_locks.pop(k, None)


async def cleanup_stale_db_calls(agent_id: str | None = None, lead_id: str | None = None):
    """
    Checks MongoDB for any call with status='live' that is no longer active in memory or stream task has finished.
    Automatically marks stale calls as 'completed' so agents are never permanently locked out.
    """
    query = {"status": "live"}
    if agent_id or lead_id:
        conditions = []
        if agent_id:
            conditions.append({"agent_id": agent_id})
        if lead_id:
            conditions.append({"lead_id": lead_id})
        query["$or"] = conditions

    now = utcnow()
    async for call in calls_col.find(query):
        call_id_str = str(call["_id"])
        started_at = call.get("started_at")

        # Check if stream task is active
        has_active_stream = call_id_str in active_call_streams and not active_call_streams[call_id_str].done()

        # Stale criteria: no active stream task OR started > 120s ago without stream task
        is_stale = not has_active_stream
        if started_at:
            delta = (now.replace(tzinfo=None) - started_at.replace(tzinfo=None)).total_seconds()
            if delta > 120 and not has_active_stream:
                is_stale = True

        if is_stale:
            await calls_col.update_one(
                {"_id": call["_id"]},
                {"$set": {
                    "status": "completed",
                    "outcome": "stale_auto_cleaned",
                    "notes": "Session automatically cleaned after inactivity",
                    "ended_at": now
                }}
            )
            task = active_call_streams.pop(call_id_str, None)
            if task and not task.done():
                task.cancel()
            release_call_lock(agent_id=call.get("agent_id"), call_id=call_id_str)
            print(f"[calls] Auto-cleaned stale ghost call: {call_id_str}")



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


@router.get("/active")
async def get_current_active_call(user: dict = Depends(get_current_user)):
    """Returns the current user's live active call session (if any), after cleaning stale sessions."""
    agent_id = _uid(user)
    await cleanup_stale_db_calls(agent_id=agent_id)

    call = await calls_col.find_one({"agent_id": agent_id, "status": "live"})
    if not call:
        return None

    lead = await leads_col.find_one({"_id": ObjectId(call.get("lead_id"))}) if call.get("lead_id") and ObjectId.is_valid(call.get("lead_id")) else None
    call_data = oid_str(call)
    call_data["phone"] = lead.get("phone") if lead else call.get("phone", "")
    call_data["lead_name"] = lead.get("name") if lead else "Customer"
    return call_data


@router.post("/{call_id}/force-end")
async def force_end_stuck_call(call_id: str, user: dict = Depends(get_current_user)):
    """Force terminates a call session that is stuck or stale."""
    query = {"_id": ObjectId(call_id)} if ObjectId.is_valid(call_id) else {"_id": call_id}
    call = await calls_col.find_one(query)
    if call:
        task = active_call_streams.pop(call_id, None)
        if task and not task.done():
            task.cancel()

        await calls_col.update_one(
            query,
            {"$set": {"status": "completed", "outcome": "force_ended", "ended_at": utcnow()}}
        )
        release_call_lock(agent_id=call.get("agent_id"), call_id=call_id)
        await ws_manager.broadcast("global", {"event": "call_ended", "call_id": call_id, "outcome": "force_ended"})
    else:
        release_call_lock(agent_id=_uid(user), call_id=call_id)

    return {"status": "success", "message": "Call session force cleared"}


@router.get("/vapi-config-check")
async def check_vapi_config():
    """
    Configuration check endpoint for Vapi AI calling variables.
    Shows exactly which required configuration variables are set or missing.
    """
    vapi_api_key = getattr(settings, 'VAPI_API_KEY', '') or os.getenv('VAPI_API_KEY', '')
    vapi_assistant_id = getattr(settings, 'VAPI_ASSISTANT_ID', '') or os.getenv('VAPI_ASSISTANT_ID', '')
    vapi_phone_id = getattr(settings, 'VAPI_PHONE_NUMBER_ID', '') or os.getenv('VAPI_PHONE_NUMBER_ID', '')
    vapi_base_url = getattr(settings, 'VAPI_BASE_URL', '') or os.getenv('VAPI_BASE_URL', 'https://api.vapi.ai')

    missing = []
    if not vapi_api_key:
        missing.append("VAPI_API_KEY")
    if not vapi_assistant_id:
        missing.append("VAPI_ASSISTANT_ID")
    if not vapi_phone_id:
        missing.append("VAPI_PHONE_NUMBER_ID")
    if not vapi_base_url:
        missing.append("VAPI_BASE_URL")

    return {
        "configured": len(missing) == 0,
        "missing": missing,
        "config": {
            "VAPI_API_KEY": "configured" if vapi_api_key else "missing",
            "VAPI_ASSISTANT_ID": vapi_assistant_id if vapi_assistant_id else "missing",
            "VAPI_PHONE_NUMBER_ID": vapi_phone_id if vapi_phone_id else "missing",
            "VAPI_BASE_URL": vapi_base_url,
        }
    }


def mask_phone(phone_str: str) -> str:
    cleaned = str(phone_str).strip()
    if len(cleaned) <= 6:
        return "***"
    return cleaned[:3] + "*****" + cleaned[-3:]


@router.post("/vapi-dial", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER, Role.AGENT))])
async def start_vapi_dial(payload: VapiDialPayload, user: dict = Depends(get_current_user)):
    """
    Initiates an outbound AI Voice Agent call via Vapi API.
    Validates environment variables and lead phone numbers, authenticates with Vapi,
    and returns a structured response without hiding original Vapi errors.
    """
    log = logging.getLogger("uvicorn.error")
    log.info(f"Vapi dial request started | Lead Phone: {payload.phone}")

    e164_phone = normalize_e164(payload.phone)
    if not e164_phone or len(e164_phone) < 10:
        log.error(f"Phone number validation failed: {payload.phone}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": "Invalid phone number provided",
                "status": 400,
                "details": f"Provided phone number '{payload.phone}' is invalid. Must be valid mobile digits."
            }
        )

    log.info(f"Phone number validated: {mask_phone(e164_phone)}")

    vapi_api_key = getattr(settings, 'VAPI_API_KEY', '') or os.getenv('VAPI_API_KEY', '')
    vapi_assistant_id = payload.assistant_id or getattr(settings, 'VAPI_ASSISTANT_ID', '') or os.getenv('VAPI_ASSISTANT_ID', '')
    vapi_phone_id = payload.phone_number_id or getattr(settings, 'VAPI_PHONE_NUMBER_ID', '') or os.getenv('VAPI_PHONE_NUMBER_ID', '')
    vapi_base_url = (getattr(settings, 'VAPI_BASE_URL', '') or os.getenv('VAPI_BASE_URL', 'https://api.vapi.ai')).rstrip('/')

    missing_configs = []
    if not vapi_api_key:
        missing_configs.append("VAPI_API_KEY")
    if not vapi_assistant_id:
        missing_configs.append("VAPI_ASSISTANT_ID")
    if not vapi_phone_id:
        missing_configs.append("VAPI_PHONE_NUMBER_ID")

    if missing_configs:
        err_msg = f"Missing Vapi configuration environment variables: {', '.join(missing_configs)}"
        log.error(f"[Vapi Dial Error] {err_msg}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "error": "Vapi configuration missing",
                "status": 400,
                "details": err_msg
            }
        )

    assigned_agent_id = _uid(user)
    lead = await leads_col.find_one({"phone": e164_phone})
    if not lead:
        lead = await leads_col.find_one({"phone": payload.phone})

    lead_id_str = str(lead.get("_id")) if lead else "temp_" + e164_phone.replace("+", "")

    # Automatically clean any stale ghost call sessions
    await cleanup_stale_db_calls(agent_id=assigned_agent_id, lead_id=lead_id_str)

    acquired, lock_reason = acquire_call_lock(e164_phone, assigned_agent_id, payload.idempotency_key)
    if not acquired:
        if lock_reason == "IDEMPOTENCY_HIT" and payload.idempotency_key:
            return processed_idempotency_keys[payload.idempotency_key]["result"]
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "success": False,
                "error": "Active call lock conflict",
                "status": 409,
                "details": lock_reason
            }
        )

    base_url = getattr(settings, 'BASE_URL', 'https://ai-voice-agent-crm.onrender.com').rstrip('/')
    vapi_payload = {
        "assistantId": vapi_assistant_id,
        "phoneNumberId": vapi_phone_id,
        "customer": {
            "number": e164_phone,
            "name": payload.name or (lead.get("name") if lead else f"Customer - {e164_phone}")
        },
        "assistantOverrides": {
            "serverUrl": f"{base_url}/api/calls/vapi-webhook"
        }
    }

    headers = {
        "Authorization": f"Bearer {vapi_api_key}",
        "Content-Type": "application/json"
    }

    vapi_endpoint = f"{vapi_base_url}/call"
    log.info(
        f"Vapi request sent to {vapi_endpoint} | Lead ID: {lead_id_str} | Phone: {mask_phone(e164_phone)} | "
        f"Assistant ID: {vapi_assistant_id} | Phone Number ID: {vapi_phone_id}"
    )

    vapi_call_id = None

    try:
        client = get_http_client()
        res = await client.post(vapi_endpoint, json=vapi_payload, headers=headers, timeout=10.0)
        log.info(f"Vapi response status: {res.status_code}")

        if res.status_code in (200, 201):
            res_data = res.json()
            vapi_call_id = res_data.get("id")
            log.info(f"Vapi call ID: {vapi_call_id}")
        else:
            release_call_lock(phone=e164_phone, agent_id=assigned_agent_id)
            err_text = res.text
            try:
                err_json = res.json()
                err_msg = err_json.get("message") or err_json.get("error") or err_text
                if isinstance(err_msg, list):
                    err_msg = "; ".join([str(x) for x in err_msg])
            except Exception:
                err_msg = err_text

            log.error(
                f"[Vapi API Failure] Lead ID: {lead_id_str} | Phone: {mask_phone(e164_phone)} | "
                f"Vapi Status: {res.status_code} | Error: {err_msg}"
            )

            return JSONResponse(
                status_code=res.status_code if res.status_code in (400, 401, 403, 404, 500) else status.HTTP_400_BAD_REQUEST,
                content={
                    "success": False,
                    "error": f"Vapi call creation failed ({res.status_code})",
                    "status": res.status_code,
                    "details": str(err_msg)
                }
            )
    except httpx.TimeoutException:
        release_call_lock(phone=e164_phone, agent_id=assigned_agent_id)
        log.error(f"[Vapi Timeout] Lead ID: {lead_id_str} | Phone: {mask_phone(e164_phone)} timed out after 15s")
        return JSONResponse(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            content={
                "success": False,
                "error": "Vapi API request timed out",
                "status": 504,
                "details": "Vapi API request timed out (15s). Please verify network and Vapi service status."
            }
        )
    except Exception as exc:
        release_call_lock(phone=e164_phone, agent_id=assigned_agent_id)
        log.error(f"[Vapi Connection Exception] Lead ID: {lead_id_str} | Error: {str(exc)}")
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={
                "success": False,
                "error": "Failed to connect to Vapi API",
                "status": 502,
                "details": str(exc)
            }
        )

    doc = {
        "lead_id": lead_id_str,
        "pool_id": payload.pool_id or "general",
        "agent_id": assigned_agent_id,
        "direction": "outbound",
        "status": "live",
        "call_mode": "ai",
        "is_ai": True,
        "vapi_call_id": vapi_call_id,
        "call_state": "active",
        "muted": False,
        "priority": "high",
        "language": "english",
        "notes": "Vapi AI Voice Agent Call",
        "sip_logs": [
            f"[{utcnow().isoformat()}] [VAPI] Initiated outbound AI call to {e164_phone}",
            f"[{utcnow().isoformat()}] [VAPI] Vapi Call ID: {vapi_call_id}"
        ],
        "transcript_list": [],
        "ai_suggestions": [],
        "sentiment": "neutral",
        "recording_status": "recording",
        "started_at": utcnow(),
    }

    result = await calls_col.insert_one(doc)
    call_id_str = str(result.inserted_id)
    doc["_id"] = result.inserted_id

    response_doc = oid_str(doc)
    response_doc["success"] = True
    response_doc["message"] = "Call started successfully"
    response_doc["callId"] = vapi_call_id

    register_call_lock(e164_phone, assigned_agent_id, call_id_str, payload.idempotency_key, response_doc)

    ws_payload = {
        "event": "vapi_call_started",
        "call_id": call_id_str,
        "vapi_call_id": vapi_call_id,
        "phone": e164_phone,
        "agent_id": assigned_agent_id,
        "status": "calling"
    }
    await ws_manager.broadcast("global", ws_payload)

    return JSONResponse(status_code=status.HTTP_200_OK, content=response_doc)



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
        lead = await leads_col.find_one({"phone": normalized_phone})

    if not lead:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")

    lead_id_str = str(lead.get("_id"))
    assigned_agent_id = payload.assigned_agent_id or _uid(user)

    # Automatically clean any stale ghost call sessions for this agent or lead
    await cleanup_stale_db_calls(agent_id=assigned_agent_id, lead_id=lead_id_str)

    # 1. Check idempotency key or active call locks
    acquired, lock_reason = acquire_call_lock(normalized_phone, assigned_agent_id, payload.idempotency_key)
    if not acquired:
        if lock_reason == "IDEMPOTENCY_HIT" and payload.idempotency_key:
            return processed_idempotency_keys[payload.idempotency_key]["result"]
        # Double check if lock is stale
        await cleanup_stale_db_calls(agent_id=assigned_agent_id, lead_id=lead_id_str)
        acquired_retry, lock_reason_retry = acquire_call_lock(normalized_phone, assigned_agent_id, payload.idempotency_key)
        if not acquired_retry:
            raise HTTPException(status.HTTP_409_CONFLICT, lock_reason_retry)

    # 2. Check DB for active live call
    existing_call = await calls_col.find_one({
        "$or": [
            {"lead_id": lead_id_str, "status": "live"},
            {"agent_id": assigned_agent_id, "status": "live"}
        ]
    })
    if existing_call:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"An active call session already exists (Call ID: {str(existing_call['_id'])})"
        )

    agent_phone = None
    if payload.agent_assign_mode == "manual" and payload.assigned_agent_id:
        agent_oid = _safe_oid(payload.assigned_agent_id)
        if agent_oid:
            agent = await users_col.find_one({"_id": agent_oid})
            if agent:
                agent_phone = agent.get("phone")
    elif payload.agent_assign_mode == "auto":
        online_agent = await users_col.find_one({"role": Role.AGENT, "pool_id": payload.pool_id, "status": "online"})
        if online_agent:
            assigned_agent_id = str(online_agent["_id"])
            agent_phone = online_agent.get("phone")
        else:
            assigned_agent_id = _uid(user)
            agent_phone = user.get("phone")

    # Vapi AI Voice Agent trigger if call_mode == "ai"
    vapi_call_id = None
    is_ai_call = (getattr(payload, 'call_mode', 'human') == 'ai')

    if is_ai_call:
        vapi_api_key = getattr(settings, 'VAPI_API_KEY', '') or os.getenv('VAPI_API_KEY', '')
        vapi_assistant_id = getattr(settings, 'VAPI_ASSISTANT_ID', '') or os.getenv('VAPI_ASSISTANT_ID', '')
        vapi_phone_id = getattr(settings, 'VAPI_PHONE_NUMBER_ID', '') or os.getenv('VAPI_PHONE_NUMBER_ID', '')

        if vapi_api_key and vapi_assistant_id:
            try:
                import httpx
                vapi_payload = {
                    "assistantId": vapi_assistant_id,
                    "customer": {
                        "number": normalized_phone,
                        "name": lead.get("name", "Customer")
                    }
                }
                if vapi_phone_id:
                    vapi_payload["phoneNumberId"] = vapi_phone_id

                headers = {
                    "Authorization": f"Bearer {vapi_api_key}",
                    "Content-Type": "application/json"
                }
                client = get_http_client()
                res = await client.post("https://api.vapi.ai/call", json=vapi_payload, headers=headers, timeout=10.0)
                if res.status_code in (200, 201):
                    res_data = res.json()
                    vapi_call_id = res_data.get("id")
                    print(f"[Vapi] Call initiated successfully. Vapi Call ID: {vapi_call_id}")
                else:
                    print(f"[Vapi] API Error: {res.status_code} - {res.text}")
            except Exception as vapi_err:
                print(f"[Vapi] Exception calling Vapi API: {vapi_err}")

    # Actually trigger Twilio call if configured and initiate_pstn is requested (WebRTC calls handle dialing natively)
    twilio_sid = None
    try:
        # pyrefly: ignore [missing-import]
        from twilio.rest import Client
        from app.core.config import settings
        if payload.initiate_pstn and hasattr(settings, 'TWILIO_ACCOUNT_SID') and settings.TWILIO_ACCOUNT_SID:
            client = Client(getattr(settings, 'TWILIO_API_KEY', settings.TWILIO_ACCOUNT_SID),
                            getattr(settings, 'TWILIO_API_SECRET', getattr(settings, 'TWILIO_AUTH_TOKEN', '')),
                            settings.TWILIO_ACCOUNT_SID)

            from_number = getattr(settings, 'TWILIO_PHONE_NUMBER', '+12345678900')

            twiml_url = f"<Response><Say>Please hold while we connect your call.</Say>"
            if agent_phone:
                twiml_url += f"<Dial>{agent_phone}</Dial>"
            else:
                twiml_url += "<Play loop=\"0\">http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play>"
            twiml_url += "</Response>"

            call = client.calls.create(
                to=normalized_phone,
                from_=from_number,
                twiml=twiml_url
            )
            twilio_sid = call.sid
    except Exception as e:
        print(f"Failed to initiate Twilio call: {e}")

    sip_logs = [
        f"[{utcnow().isoformat()}] [SIP] INVITE sip:{payload.pool_id}@forge-pbx.local SIP/2.0",
        f"[{utcnow().isoformat()}] [SIP] From: <sip:{normalized_phone}@sip-carrier.net>;tag=as312df5",
        f"[{utcnow().isoformat()}] [SIP] To: <sip:{payload.pool_id}@forge-pbx.local>",
        f"[{utcnow().isoformat()}] [SIP] Sending: SIP/2.0 100 Trying",
        f"[{utcnow().isoformat()}] [SIP] Sending: SIP/2.0 180 Ringing",
        f"[{utcnow().isoformat()}] [SIP] Sending: SIP/2.0 200 OK",
        f"[{utcnow().isoformat()}] [SIP] Call established via {'Vapi AI Agent' if is_ai_call else 'WebRTC Trunk'} (Twilio SID: {twilio_sid}, Vapi ID: {vapi_call_id})"
    ]

    doc = {
        "lead_id": lead_id_str,
        "pool_id": payload.pool_id,
        "agent_id": assigned_agent_id,
        "direction": "outbound",
        "status": "live",
        "call_mode": getattr(payload, 'call_mode', 'human') or 'human',
        "is_ai": is_ai_call,
        "vapi_call_id": vapi_call_id,
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
        "twilio_sid": twilio_sid
    }

    result = await calls_col.insert_one(doc)
    call_id_str = str(result.inserted_id)
    doc["_id"] = result.inserted_id

    response_doc = oid_str(doc)
    register_call_lock(normalized_phone, assigned_agent_id, call_id_str, payload.idempotency_key, response_doc)

    task = asyncio.create_task(simulate_call_stream(call_id_str, payload.pool_id))
    active_call_streams[call_id_str] = task

    ws_payload = {
        "event": "call_started",
        "call_id": call_id_str,
        "lead_name": lead["name"],
        "agent_id": assigned_agent_id,
        "pool_id": payload.pool_id,
        "direction": "outbound",
        "is_manual": True,
        "sip_logs": sip_logs
    }
    await ws_manager.broadcast("global", ws_payload)
    await ws_manager.broadcast(payload.pool_id, ws_payload)

    return response_doc


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
    query = {"_id": ObjectId(call_id)} if ObjectId.is_valid(call_id) else {"_id": call_id}
    call = await calls_col.find_one(query)
    if not call:
        call = await calls_col.find_one({"id": call_id})
    if not call:
        # For manual demo calls not yet persisted in DB, synthesize response
        return {"status": "success", "message": "Manual call session ended", "call_id": call_id}
        
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
    release_call_lock(agent_id=call.get("agent_id") or _uid(user), call_id=call_id)
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


@router.post("/vapi-webhook")
async def vapi_webhook(request: Request):
    """
    Vapi Webhook endpoint to process real-time call events from Vapi AI.
    Handles status updates, live transcript dialogue, and end-of-call reports.
    """
    try:
        body = await request.json()
        message = body.get("message", {})
        msg_type = message.get("type")
        vapi_call = message.get("call", {})
        vapi_call_id = vapi_call.get("id")

        if not vapi_call_id:
            return {"status": "ok"}

        db_call = await calls_col.find_one({"vapi_call_id": vapi_call_id})
        if not db_call:
            return {"status": "ok"}

        call_id_str = str(db_call["_id"])
        pool_id = db_call.get("pool_id", "global")

        if msg_type == "transcript":
            role = message.get("role")
            speaker = "customer" if role == "user" else "agent"
            text = message.get("transcript", "")

            if text:
                new_entry = {
                    "speaker": speaker,
                    "text": text,
                    "timestamp": utcnow().isoformat()
                }
                await calls_col.update_one(
                    {"_id": db_call["_id"]},
                    {"$push": {"transcript_list": new_entry}}
                )

                update_payload = {
                    "event": "manual_call_update",
                    "call_id": call_id_str,
                    "vapi_call_id": vapi_call_id,
                    "speaker": speaker,
                    "text": text,
                    "timestamp": new_entry["timestamp"]
                }
                await ws_manager.broadcast("global", update_payload)
                await ws_manager.broadcast(pool_id, update_payload)

        elif msg_type == "status-update":
            vapi_status = message.get("status")
            if vapi_status in ("ringing", "in-progress", "queued", "forwarding"):
                status_mapped = "ringing" if vapi_status == "ringing" else ("connected" if vapi_status in ("in-progress", "forwarding") else "calling")
                await calls_col.update_one(
                    {"_id": db_call["_id"]},
                    {"$set": {"call_state": status_mapped}}
                )
                ws_update = {
                    "event": "vapi_call_status",
                    "call_id": call_id_str,
                    "vapi_call_id": vapi_call_id,
                    "call_status": status_mapped,
                    "vapi_raw_status": vapi_status
                }
                await ws_manager.broadcast("global", ws_update)
                await ws_manager.broadcast(pool_id, ws_update)
            elif vapi_status == "ended":
                await calls_col.update_one(
                    {"_id": db_call["_id"]},
                    {"$set": {"status": "completed", "call_state": "ended", "outcome": "vapi_completed", "ended_at": utcnow()}}
                )
                release_call_lock(agent_id=db_call.get("agent_id"), call_id=call_id_str)
                await ws_manager.broadcast("global", {"event": "call_ended", "call_id": call_id_str, "outcome": "vapi_completed"})

        elif msg_type == "end-of-call-report":
            summary = message.get("summary")
            recording_url = message.get("recordingUrl")
            update_data = {"status": "completed", "outcome": "vapi_completed", "ended_at": utcnow()}
            if summary:
                update_data["notes"] = summary
            if recording_url:
                update_data["recording_file"] = recording_url

            await calls_col.update_one({"_id": db_call["_id"]}, {"$set": update_data})
            release_call_lock(agent_id=db_call.get("agent_id"), call_id=call_id_str)
            await ws_manager.broadcast("global", {"event": "call_ended", "call_id": call_id_str, "outcome": "vapi_completed"})

    except Exception as e:
        print(f"[Vapi Webhook Error] {e}")

    return {"status": "ok"}


