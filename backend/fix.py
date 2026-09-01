import asyncio
from app.core.database import users_col, agent_presence_col, agent_shifts_col

async def fix():
    r1 = await users_col.update_many({"waiting_seconds": {"$gt": 28800}}, {"$set": {"waiting_seconds": 0, "waiting_started_at": None}})
    print("Users updated:", r1.modified_count)
    r2 = await agent_presence_col.update_many({"waiting_seconds": {"$gt": 28800}}, {"$set": {"waiting_seconds": 0, "waiting_started_at": None}})
    print("Presence updated:", r2.modified_count)
    r3 = await agent_shifts_col.update_many({"waiting_seconds": {"$gt": 28800}}, {"$set": {"waiting_seconds": 0, "waiting_started_at": None}})
    print("Shifts updated:", r3.modified_count)

if __name__ == "__main__":
    asyncio.run(fix())
