import io
import time as time_mod
import asyncio
import logging
from datetime import datetime, time, timedelta, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse

from app.core.database import (
    calls_col, leads_col, users_col, campaigns_col,
    pools_col, imports_col, audit_logs_col, check_db_connection
)
from app.core.deps import require_roles, get_current_user
from app.core.security import decode_token
from app.core.utils import utcnow, oid_str
from app.schemas.common import Role

logger = logging.getLogger("uvicorn.error")

router = APIRouter(prefix="/api/reports", tags=["reports"])

# ── Lightweight In-Memory TTL Cache for Dashboard Summary ─────────────────────
_summary_cache = {}
_SUMMARY_CACHE_TTL = 5.0  # 5 seconds TTL


# ── Helpers ──────────────────────────────────────────────────────────────────
def _safe_objectid(value: str | None) -> ObjectId | None:
    """Convert a string to ObjectId, returning None on failure."""
    if not value:
        return None
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        return None


# ── Summary ──────────────────────────────────────────────────────────────────
@router.get("/summary")
async def summary(user: dict = Depends(get_current_user), pool_id: str | None = None):
    """Aggregate all CRM metrics for the Admin and Supervisor dashboards concurrently."""
    try:
        uid = user.get("id") or str(user["_id"])
        role = user["role"]
        cache_key = f"{uid}:{role}:{pool_id or ''}"
        now_ts = time_mod.monotonic()

        # Return cached result if valid
        if cache_key in _summary_cache:
            cached_data, cached_at = _summary_cache[cache_key]
            if now_ts - cached_at < _SUMMARY_CACHE_TTL:
                return cached_data

        # Default queries setup
        call_query = {"pool_id": pool_id} if pool_id else {}
        lead_query = {"pool_id": pool_id} if pool_id else {}
        campaign_query = {"pool_id": pool_id} if pool_id else {}
        user_query = {"pool_id": pool_id} if pool_id else {}

        # Scoping by role: Supervisor (TEAM_LEADER) can access only their assigned data
        if role == Role.TEAM_LEADER:
            assigned_agents = await users_col.find({"supervisor_id": uid, "role": Role.AGENT}, {"_id": 1}).to_list(length=1000)
            agent_ids = [str(a["_id"]) for a in assigned_agents]
            
            call_query["agent_id"] = {"$in": agent_ids}
            lead_query["supervisor_id"] = uid
            campaign_query["supervisor_id"] = uid
            user_query["supervisor_id"] = uid
            
            if not pool_id and user.get("pool_id"):
                pool_id = user.get("pool_id")
                call_query["pool_id"] = pool_id
                lead_query["pool_id"] = pool_id
                campaign_query["pool_id"] = pool_id
                user_query["pool_id"] = pool_id
        elif role == Role.AGENT:
            call_query["agent_id"] = uid
            lead_query["assigned_agent_id"] = uid
            if user.get("pool_id"):
                campaign_query["pool_id"] = user.get("pool_id")
            else:
                campaign_query["_id"] = None
            user_query["_id"] = ObjectId(uid)

        now = utcnow()
        today_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
        today_end = datetime.combine(now.date(), time.max, tzinfo=timezone.utc)
        
        today_query = {"started_at": {"$gte": today_start}, **call_query}
        today_followup_query = {
            "status": "follow_up",
            "follow_up_at": {"$gte": today_start, "$lte": today_end},
            **lead_query
        }
        today_import_query = {"created_at": {"$gte": today_start}}
        if role == Role.TEAM_LEADER:
            today_import_query["created_by"] = uid
        elif pool_id:
            today_import_query["pool_id"] = pool_id

        # Run independent queries concurrently in parallel using asyncio.gather
        (
            total_pools,
            total_campaigns,
            total_leads,
            total_supervisors,
            total_agents,
            active_agents,
            total_calls,
            answered,
            missed,
            transferred,
            qualified,
            not_interested,
            today_calls,
            today_followups,
            active_calls,
            ai_calls,
            queue_count,
            db_ok
        ) = await asyncio.gather(
            pools_col.count_documents({"is_deleted": {"$ne": True}}),
            campaigns_col.count_documents(campaign_query),
            leads_col.count_documents(lead_query),
            asyncio.sleep(0, result=1) if role == Role.TEAM_LEADER else users_col.count_documents({**user_query, "role": Role.TEAM_LEADER}),
            users_col.count_documents({**user_query, "role": Role.AGENT}),
            users_col.count_documents({**user_query, "role": Role.AGENT, "status": {"$in": ["online", "busy", "break", "active"]}}),
            calls_col.count_documents(call_query),
            calls_col.count_documents({**call_query, "outcome": "answered"}),
            calls_col.count_documents({**call_query, "outcome": "missed"}),
            calls_col.count_documents({**call_query, "outcome": "transferred"}),
            leads_col.count_documents({**lead_query, "status": "qualified"}),
            leads_col.count_documents({**lead_query, "status": "not_interested"}),
            calls_col.count_documents(today_query),
            leads_col.count_documents(today_followup_query),
            calls_col.count_documents({**call_query, "status": "live"}),
            calls_col.count_documents({**call_query, "status": "live", "is_ai": True}),
            leads_col.count_documents({**lead_query, "status": "new"}),
            check_db_connection()
        )

        today_imports = 0
        async for imp in imports_col.find(today_import_query, {"inserted": 1}):
            today_imports += imp.get("inserted", 0)

        success_rate = round((answered / total_calls) * 100, 2) if total_calls else 0.0
        conversion_rate = round((qualified / total_leads) * 100, 2) if total_leads else 0.0
        team_performance = success_rate if role == Role.TEAM_LEADER else 0.0

        res_payload = {
            "total_pools": total_pools,
            "total_supervisors": total_supervisors,
            "total_agents": total_agents,
            "active_agents": active_agents,
            "total_campaigns": total_campaigns,
            "total_leads": total_leads,
            "total_calls": total_calls,
            "answered_calls": answered,
            "missed_calls": missed,
            "transferred_calls": transferred,
            "qualified_leads": qualified,
            "rejected_leads": not_interested,
            "active_calls": active_calls,
            "today_calls": today_calls,
            "today_imports": today_imports,
            "success_rate": success_rate,
            "conversion_rate": conversion_rate,
            "today_followups": today_followups,
            "today_conversions": qualified,
            "team_performance": team_performance,
            "queue_status": {
                "waiting_leads": queue_count,
                "status": "normal" if queue_count < 100 else "congested"
            },
            "ai_agent_status": {
                "active_channels": ai_calls,
                "status": "idle" if ai_calls == 0 else "calling"
            },
            "system_health": {
                "mongodb": "connected" if db_ok else "disconnected",
                "api": "healthy"
            }
        }

        _summary_cache[cache_key] = (res_payload, now_ts)
        return res_payload

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /summary: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate summary report. Please try again."
        )


# ── Agent Performance ────────────────────────────────────────────────────────
@router.get("/agent-performance", dependencies=[Depends(require_roles(Role.TEAM_LEADER, Role.ADMIN))])
async def agent_performance(pool_id: str | None = None, user: dict = Depends(get_current_user)):
    try:
        pipeline = []
        match = {}
        if pool_id:
            match["pool_id"] = pool_id
            
        if user["role"] == Role.TEAM_LEADER:
            uid = user.get("id") or str(user["_id"])
            assigned_agents = await users_col.find({"supervisor_id": uid, "role": Role.AGENT}).to_list(length=1000)
            agent_ids = [str(a["_id"]) for a in assigned_agents]
            match["agent_id"] = {"$in": agent_ids}
            
        if match:
            pipeline.append({"$match": match})
            
        pipeline += [
            {"$group": {
                "_id": "$agent_id",
                "total_calls": {"$sum": 1},
                "answered": {"$sum": {"$cond": [{"$eq": ["$outcome", "answered"]}, 1, 0]}},
                "qualified": {"$sum": {"$cond": [{"$eq": ["$outcome", "qualified"]}, 1, 0]}},
                "avg_duration": {"$avg": "$duration_seconds"},
            }},
            {"$sort": {"total_calls": -1}},
        ]
        results = []
        async for r in calls_col.aggregate(pipeline):
            # Guard against invalid ObjectId values in agent_id
            agent_oid = _safe_objectid(r["_id"])
            agent = await users_col.find_one({"_id": agent_oid}) if agent_oid else None
            results.append({
                "agent_id": r["_id"] or "unknown",
                "agent_name": agent["name"] if agent else "Unknown Agent",
                "employee_id": agent.get("employee_id", "N/A") if agent else "N/A",
                "total_calls": r["total_calls"],
                "answered": r["answered"],
                "qualified": r["qualified"],
                "avg_duration_seconds": round(r["avg_duration"] or 0, 1),
                "conversion_rate": round((r["qualified"] / r["total_calls"]) * 100, 1) if r["total_calls"] else 0.0
            })
        return results

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /agent-performance: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate agent performance report. Please try again."
        )


# ── Recent Activities ────────────────────────────────────────────────────────
@router.get("/recent-activities", dependencies=[Depends(require_roles(Role.ADMIN, Role.TEAM_LEADER))])
async def recent_activities(user: dict = Depends(get_current_user)):
    """Fetch the latest audit logs for dashboard view (batch optimized with TTL cache)."""
    try:
        uid = user.get("id") or str(user["_id"])
        role = user["role"]
        cache_key = f"recent_act:{uid}:{role}"
        now_ts = time_mod.monotonic()

        if cache_key in _summary_cache:
            cached_data, cached_at = _summary_cache[cache_key]
            if now_ts - cached_at < 3.0:
                return cached_data

        query = {}
        if role == Role.TEAM_LEADER:
            assigned_agents = await users_col.find({"supervisor_id": uid, "role": Role.AGENT}, {"_id": 1}).to_list(length=1000)
            agent_ids = [str(a["_id"]) for a in assigned_agents]
            query["$or"] = [
                {"user_id": uid},
                {"target_user_id": {"$in": agent_ids}},
                {"user_id": {"$in": agent_ids}}
            ]
            
        logs_raw = await audit_logs_col.find(query).sort("timestamp", -1).limit(20).to_list(length=20)
        
        actor_oids = []
        for log in logs_raw:
            user_id = log.get("user_id")
            if user_id and isinstance(user_id, str) and ObjectId.is_valid(user_id):
                actor_oids.append(ObjectId(user_id))
                
        user_map = {}
        if actor_oids:
            users_cursor = await users_col.find({"_id": {"$in": actor_oids}}, {"_id": 1, "name": 1}).to_list(length=len(actor_oids))
            for u in users_cursor:
                user_map[str(u["_id"])] = u.get("name", "System")

        logs = []
        for log in logs_raw:
            actor_id_str = str(log.get("user_id") or "")
            log["actor_name"] = user_map.get(actor_id_str, "System")
            logs.append(oid_str(log))

        _summary_cache[cache_key] = (logs, now_ts)
        return logs

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /recent-activities: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load recent activities. Please try again."
        )


# ── Export ────────────────────────────────────────────────────────────────────
@router.get("/export")
async def export_report(
    request: Request,
    report_type: str = Query(...),
    format: str = Query(...),
    token: str | None = Query(None),
):
    """Export CRM reports. Formats: excel, csv, pdf (returns printable HTML formatted sheet).
    
    Accepts authentication via:
    1. Standard Authorization: Bearer <token> header
    2. Query parameter: ?token=<token> (for direct download links)
    """
    if format not in ["csv", "excel", "pdf"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported format: choose csv, excel, or pdf")

    # Authenticate: try Authorization header first, then query param fallback
    auth_header = request.headers.get("authorization", "")
    jwt_token = None
    if auth_header.startswith("Bearer "):
        jwt_token = auth_header[7:]
    elif token:
        jwt_token = token

    if not jwt_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required for export")

    payload = decode_token(jwt_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    user = await users_col.find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("is_active", True):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    # Check role access
    role = user["role"]
    if role not in [Role.ADMIN, Role.TEAM_LEADER]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions for export")

    uid = str(user["_id"])

    try:
        assigned_agents = await users_col.find({"supervisor_id": uid, "role": Role.AGENT}).to_list(length=1000)
        agent_ids = [str(a["_id"]) for a in assigned_agents]

        # Fetch data based on report type
        data_list = []
        filename = f"report_{report_type}_{datetime.now().strftime('%Y%m%d')}"

        if report_type == "campaign":
            query = {}
            if role == Role.TEAM_LEADER:
                query["supervisor_id"] = uid
            async for c in campaigns_col.find(query):
                data_list.append({
                    "Campaign ID": c.get("campaign_id"),
                    "Campaign Name": c.get("name"),
                    "Pool ID": c.get("pool_id"),
                    "Calling Hours": c.get("calling_hours"),
                    "Max Retry": c.get("max_retry"),
                    "Status": c.get("status")
                })
                
        elif report_type == "agent_performance":
            match = {}
            if role == Role.TEAM_LEADER:
                match["agent_id"] = {"$in": agent_ids}
            pipeline = []
            if match:
                pipeline.append({"$match": match})
            pipeline += [
                {"$group": {
                    "_id": "$agent_id",
                    "total_calls": {"$sum": 1},
                    "answered": {"$sum": {"$cond": [{"$eq": ["$outcome", "answered"]}, 1, 0]}},
                    "qualified": {"$sum": {"$cond": [{"$eq": ["$outcome", "qualified"]}, 1, 0]}},
                    "avg_duration": {"$avg": "$duration_seconds"},
                }}
            ]
            async for r in calls_col.aggregate(pipeline):
                agent_oid = _safe_objectid(r["_id"])
                agent = await users_col.find_one({"_id": agent_oid}) if agent_oid else None
                data_list.append({
                    "Employee ID": agent.get("employee_id", "N/A") if agent else "N/A",
                    "Agent Name": agent["name"] if agent else "Unknown Agent",
                    "Total Calls": r["total_calls"],
                    "Answered": r["answered"],
                    "Qualified": r["qualified"],
                    "Avg Duration (Secs)": round(r["avg_duration"] or 0, 1)
                })
                
        elif report_type == "call_analytics":
            query = {}
            if role == Role.TEAM_LEADER:
                query["agent_id"] = {"$in": agent_ids}
            async for c in calls_col.find(query):
                data_list.append({
                    "Call ID": str(c["_id"]),
                    "Lead ID": c.get("lead_id"),
                    "Agent ID": c.get("agent_id"),
                    "Direction": c.get("direction"),
                    "Outcome": c.get("outcome"),
                    "Duration (s)": c.get("duration_seconds"),
                    "Started At": c.get("started_at")
                })
                
        elif report_type == "lead_import":
            query = {}
            if role == Role.TEAM_LEADER:
                query["created_by"] = uid
            async for imp in imports_col.find(query):
                data_list.append({
                    "Import ID": imp.get("import_id"),
                    "Date": imp.get("created_at"),
                    "Processed": imp.get("total_processed"),
                    "Inserted": imp.get("inserted"),
                    "Duplicates": imp.get("skipped_duplicates"),
                    "Invalids": imp.get("skipped_invalid")
                })
                
        else:
            # Default/Fallback: Audit logs
            query = {}
            if role == Role.TEAM_LEADER:
                query["$or"] = [
                    {"user_id": uid},
                    {"target_user_id": {"$in": agent_ids}},
                    {"user_id": {"$in": agent_ids}}
                ]
            async for log in audit_logs_col.find(query):
                data_list.append({
                    "Log ID": str(log["_id"]),
                    "Action": log.get("action"),
                    "Actor ID": log.get("user_id"),
                    "Target ID": log.get("target_user_id"),
                    "Timestamp": log.get("timestamp")
                })

        if not data_list:
            df = pd.DataFrame([{"Message": "No data found for this period"}])
        else:
            df = pd.DataFrame(data_list)

        # Return CSV
        if format == "csv":
            stream = io.StringIO()
            df.to_csv(stream, index=False)
            response = StreamingResponse(
                iter([stream.getvalue()]),
                media_type="text/csv"
            )
            response.headers["Content-Disposition"] = f"attachment; filename={filename}.csv"
            return response

        # Return Excel
        elif format == "excel":
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Report")
            output.seek(0)
            response = StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )
            response.headers["Content-Disposition"] = f"attachment; filename={filename}.xlsx"
            return response

        # Return PDF (Custom printable HTML table format)
        else:
            html_table = df.to_html(classes="table table-striped table-bordered", index=False)
            html_content = f"""
            <html>
            <head>
                <title>CRM Export - {report_type}</title>
                <style>
                    body {{ font-family: sans-serif; padding: 20px; }}
                    table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                    th, td {{ border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }}
                    th {{ background-color: #f4f4f4; }}
                    h2 {{ color: #0B4EA2; }}
                    @media print {{
                        .no-print {{ display: none; }}
                    }}
                </style>
            </head>
            <body>
                <h2>CRM Report: {report_type.replace('_', ' ').title()}</h2>
                <p>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
                <button class="no-print" onclick="window.print()" style="padding: 10px; background-color: #0B4EA2; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Print / Save as PDF
                </button>
                {html_table}
            </body>
            </html>
            """
            response = StreamingResponse(
                io.BytesIO(html_content.encode("utf-8")),
                media_type="text/html"
            )
            response.headers["Content-Disposition"] = f"inline; filename={filename}.html"
            return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /export: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate export. Please try again."
        )
