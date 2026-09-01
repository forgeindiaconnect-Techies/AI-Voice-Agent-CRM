import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://127.0.0.1:27017')
    db = client['ai_voice_crm']
    res = await db.calls.update_many({'status': 'live'}, {'$set': {'status': 'completed', 'outcome': 'cleaned'}})
    print(f"Cleaned {res.modified_count} stale live calls in MongoDB")

if __name__ == '__main__':
    asyncio.run(main())
