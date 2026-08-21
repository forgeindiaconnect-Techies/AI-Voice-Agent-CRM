import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger("uvicorn.error")

# Configure AsyncIOMotorClient with connection pooling & local MongoDB options
client = AsyncIOMotorClient(
    settings.MONGO_URI,
    maxPoolSize=100,
    minPoolSize=10,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    socketTimeoutMS=10000,
    retryWrites=True,
)

db = client[settings.MONGO_DB_NAME]

# Collections definition
users_col = db["users"]
pools_col = db["pools"]                 # Recruitment / Credit Card Sales / Customer Support
supervisors_col = db["supervisors"]
agents_col = db["agents"]
campaigns_col = db["campaigns"]
leads_col = db["leads"]
imports_col = db["imports"]
call_logs_col = db["call_logs"]         # Maps to call_logs
calls_col = db["call_logs"]             # Alias for backward compatibility
ai_calls_col = db["ai_calls"]
queue_col = db["queue"]
reports_col = db["reports"]
notifications_col = db["notifications"]
audit_logs_col = db["audit_logs"]
ai_agents_col = db["ai_agents"]
settings_col = db["settings"]
notes_col = db["notes"]
leave_requests_col = db["leave_requests"]
pool_transfers_col = db["pool_transfer_requests"]
agent_shifts_col = db["agent_shifts"]


async def init_indexes():
    """Ensure all indexes for MongoDB collections are created for high query performance."""
    try:
        # Users indexes
        await users_col.create_index("email", unique=True)
        await users_col.create_index("employee_id", unique=True, sparse=True)
        await users_col.create_index("role")
        await users_col.create_index("supervisor_id")
        await users_col.create_index("pool_id")
        await users_col.create_index([("role", 1), ("supervisor_id", 1)])
        await agent_shifts_col.create_index([("user_id", 1), ("shift_date", 1)])

        # Leads indexes
        await leads_col.create_index([("phone", 1), ("pool_id", 1)])
        await leads_col.create_index("lead_id")
        await leads_col.create_index("assigned_agent_id")
        await leads_col.create_index("supervisor_id")
        await leads_col.create_index("campaign_id")
        await leads_col.create_index("pool_id")
        await leads_col.create_index("status")
        await leads_col.create_index([("created_at", -1)])
        await leads_col.create_index([("pool_id", 1), ("status", 1)])
        await leads_col.create_index([("assigned_agent_id", 1), ("status", 1)])

        # Call logs indexes
        await calls_col.create_index("lead_id")
        await calls_col.create_index("agent_id")
        await calls_col.create_index("pool_id")
        await calls_col.create_index("status")
        await calls_col.create_index("outcome")
        await calls_col.create_index([("started_at", -1)])
        await calls_col.create_index([("pool_id", 1), ("status", 1)])
        await calls_col.create_index([("agent_id", 1), ("outcome", 1)])

        # Campaigns & Pools indexes
        await campaigns_col.create_index("pool_id")
        await campaigns_col.create_index("supervisor_id")
        await agents_col.create_index("employee_id", unique=True, sparse=True)
        await supervisors_col.create_index("employee_id", unique=True, sparse=True)
        await imports_col.create_index("created_at")
        await pool_transfers_col.create_index("agent_id")
        await ai_agents_col.create_index("agent_id", unique=True, sparse=True)

        logger.info("[PERF] MongoDB indexes initialized successfully.")
    except Exception as e:
        logger.error(f"[PERF] Error initializing MongoDB indexes: {e}")
        raise e



async def check_db_connection() -> bool:
    """Verify local MongoDB connectivity."""
    try:
        await client.admin.command('ping')
        return True
    except Exception as e:
        logger.error(f"Local MongoDB connection check failed: {e}")
        return False

