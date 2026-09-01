import asyncio
from bson import ObjectId
from app.core.database import db

async def clean_stale():
    result = await db["calls"].update_many(
        {"status": "live"},
        {"$set": {"status": "completed", "outcome": "completed", "notes": "Cleaned stale live calls"}}
    )
    print(f"Cleaned {result.modified_count} stale live calls in MongoDB.")

if __name__ == "__main__":
    asyncio.run(clean_stale())
