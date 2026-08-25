import asyncio
from datetime import datetime
from app.core.database import users_col, agent_presence_col

async def repair_stale_presence():
    today_str = datetime.now().strftime("%Y-%m-%d")
    print(f"=== REPAIRING STALE PRESENCE DATA FOR DATE: {today_str} ===")

    reset_update = {
        "$set": {
            "status": "offline",
            "pause_reason": None,
            "login_at": None,
            "logout_at": None,
            "current_break": None,
            "break_logs": [],
            "total_break_seconds": 0,
            "working_seconds": 0,
            "gross_seconds": 0,
            "total_login_seconds": 0,
            "total_ready_seconds": 0,
            "total_pause_seconds": 0,
            "shift_date": today_str,
            "updated_at": datetime.utcnow().isoformat()
        }
    }

    user_res = await users_col.update_many({"role": "agent"}, reset_update)
    print(f"[REPAIR] Reset {user_res.modified_count} agent user documents in users_col.")

    presence_update = {
        "$set": {
            "status": "offline",
            "break_reason": None,
            "status_since": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
    }
    pres_res = await agent_presence_col.update_many({}, presence_update)
    print(f"[REPAIR] Reset {pres_res.modified_count} presence documents in agent_presence_col.")

    print("=== MONGODB PRESENCE REPAIR COMPLETE ===")

if __name__ == "__main__":
    asyncio.run(repair_stale_presence())
