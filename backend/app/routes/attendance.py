import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.services.attendance_service import (
    get_today_attendance,
    check_in_agent,
    start_break,
    end_break,
    set_agent_offline,
    set_agent_online,
    check_out_agent,
    get_monthly_statistics,
    get_monthly_calendar,
    get_local_now,
)
from app.services.ws_manager import ws_manager

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


def _agent_id(user: dict) -> str:
    """Extract authenticated agent's ID strictly from user payload."""
    return user.get("id") or str(user.get("_id"))


class CheckInPayload(BaseModel):
    location: str | None = "Krishnagiri Office"


class StartBreakPayload(BaseModel):
    break_type: str = "LUNCH"


@router.get("/today")
async def get_today(user: dict = Depends(get_current_user)):
    """Fetch today's attendance record & active state for the authenticated agent."""
    try:
        agent_id = _agent_id(user)
        res = await get_today_attendance(agent_id)
        return res
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] Failed to fetch today's attendance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching today's attendance: {str(e)}",
        )


@router.post("/check-in")
async def check_in(payload: CheckInPayload = CheckInPayload(), user: dict = Depends(get_current_user)):
    """Process agent check-in for today."""
    agent_id = _agent_id(user)
    try:
        location = payload.location or "Krishnagiri Office"
        record = await check_in_agent(agent_id, location=location)

        # Broadcast realtime WebSocket events across all sessions and components
        await ws_manager.broadcast_global({
            "event": "attendance:checked-in",
            "type": "attendance_checked_in",
            "action": "check_in",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "ready",
            "data": record,
        })
        await ws_manager.broadcast_global({
            "event": "agent:status-changed",
            "type": "agent_status_changed",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "ready",
            "data": record,
        })
        await ws_manager.broadcast_global({
            "event": "session:started",
            "type": "session_started",
            "agent_id": agent_id,
            "agentId": agent_id,
            "data": record,
        })

        return {"success": True, "message": "Check-in successful", "data": record}
    except ValueError as ve:
        msg = str(ve)
        status_code = status.HTTP_409_CONFLICT if "already" in msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=msg)
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] Check-in error for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Check-in failed: {str(e)}",
        )


@router.post("/break/start")
async def break_start(payload: StartBreakPayload, user: dict = Depends(get_current_user)):
    """Start an active break session (REFRESHMENT, LUNCH, PERSONAL)."""
    agent_id = _agent_id(user)
    try:
        record = await start_break(agent_id, break_type=payload.break_type)

        # Broadcast realtime WebSocket events
        await ws_manager.broadcast_global({
            "event": "attendance:break-started",
            "type": "break_started",
            "action": "break_start",
            "agent_id": agent_id,
            "agentId": agent_id,
            "break_type": payload.break_type,
            "status": "paused",
            "data": record,
        })
        await ws_manager.broadcast_global({
            "event": "agent:status-changed",
            "type": "agent_status_changed",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "paused",
            "data": record,
        })

        return {"success": True, "message": f"Your {payload.break_type.title()} break has started.", "data": record}
    except ValueError as ve:
        msg = str(ve)
        status_code = status.HTTP_409_CONFLICT if "already" in msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=msg)
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] Start break error for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start break: {str(e)}",
        )


@router.post("/break/end")
async def break_end(user: dict = Depends(get_current_user)):
    """End the active break session and resume working state."""
    agent_id = _agent_id(user)
    try:
        record = await end_break(agent_id)

        # Broadcast realtime WebSocket events
        await ws_manager.broadcast_global({
            "event": "attendance:break-ended",
            "type": "break_ended",
            "action": "break_end",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "ready",
            "data": record,
        })
        await ws_manager.broadcast_global({
            "event": "agent:status-changed",
            "type": "agent_status_changed",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "ready",
            "data": record,
        })

        return {"success": True, "message": "Your break has ended. Resumed work.", "data": record}
    except ValueError as ve:
        msg = str(ve)
        status_code = status.HTTP_409_CONFLICT if "no active break" in msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=msg)
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] End break error for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to end break: {str(e)}",
        )


@router.post("/offline")
async def go_offline(user: dict = Depends(get_current_user)):
    """Set agent operational status to OFFLINE while preserving attendance."""
    agent_id = _agent_id(user)
    try:
        record = await set_agent_offline(agent_id)

        await ws_manager.broadcast_global({
            "event": "attendance:status-changed",
            "type": "attendance_status_changed",
            "action": "go_offline",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "OFFLINE",
            "data": record,
        })
        await ws_manager.broadcast_global({
            "event": "agent:status-changed",
            "type": "agent_status_changed",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "offline",
            "data": record,
        })

        return {"success": True, "message": "Agent status set to Offline.", "data": record}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] Offline error for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set offline: {str(e)}",
        )


@router.post("/online")
async def go_online(user: dict = Depends(get_current_user)):
    """Set agent operational status back to WORKING."""
    agent_id = _agent_id(user)
    try:
        record = await set_agent_online(agent_id)

        await ws_manager.broadcast_global({
            "event": "attendance:status-changed",
            "type": "attendance_status_changed",
            "action": "go_online",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "WORKING",
            "data": record,
        })
        await ws_manager.broadcast_global({
            "event": "agent:status-changed",
            "type": "agent_status_changed",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "ready",
            "data": record,
        })

        return {"success": True, "message": "Resumed active working state.", "data": record}
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] Online error for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to set online: {str(e)}",
        )


@router.post("/check-out")
@router.post("/checkout")
async def check_out(user: dict = Depends(get_current_user)):
    """Process agent check-out, close active breaks, and calculate total working duration."""
    agent_id = _agent_id(user)
    try:
        record = await check_out_agent(agent_id)

        # Broadcast realtime WebSocket events
        await ws_manager.broadcast_global({
            "event": "attendance:checked-out",
            "type": "attendance_checked_out",
            "action": "check_out",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "offline",
            "data": record,
        })
        await ws_manager.broadcast_global({
            "event": "agent:status-changed",
            "type": "agent_status_changed",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "offline",
            "data": record,
        })
        await ws_manager.broadcast_global({
            "event": "session:updated",
            "type": "session_updated",
            "agent_id": agent_id,
            "agentId": agent_id,
            "status": "offline",
            "data": record,
        })

        return {"success": True, "message": "Check-out successful", "data": record}
    except ValueError as ve:
        msg = str(ve)
        status_code = status.HTTP_409_CONFLICT if "already" in msg.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=msg)
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] Check-out error for agent {agent_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Check-out failed: {str(e)}",
        )


@router.get("/statistics")
async def get_statistics(user: dict = Depends(get_current_user)):
    """Fetch attendance statistics (Current Month & All Time) for authenticated agent."""
    try:
        agent_id = _agent_id(user)
        res = await get_monthly_statistics(agent_id)
        return res
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] Failed to fetch statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching statistics: {str(e)}",
        )


@router.get("/calendar")
async def get_calendar(
    year: int | None = Query(None),
    month: int | None = Query(None),
    user: dict = Depends(get_current_user),
):
    """Fetch monthly calendar grid data for requested year & month."""
    try:
        agent_id = _agent_id(user)
        now = get_local_now()
        req_year = year or now.year
        req_month = month or now.month

        if req_month < 1 or req_month > 12:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month parameter (must be 1-12)")

        res = await get_monthly_calendar(agent_id, req_year, req_month)
        return res
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] Failed to fetch calendar: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching calendar: {str(e)}",
        )


@router.get("/history")
async def get_history(user: dict = Depends(get_current_user)):
    """Fetch all attendance history records for authenticated agent."""
    try:
        agent_id = _agent_id(user)
        from app.core.database import attendance_col
        from app.core.utils import oid_str

        cursor = attendance_col.find({"agent_id": agent_id}).sort("date", -1)
        history = [oid_str(doc) async for doc in cursor]
        return history
    except Exception as e:
        logger.error(f"[ATTENDANCE ERROR] Failed to fetch history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching history: {str(e)}",
        )
