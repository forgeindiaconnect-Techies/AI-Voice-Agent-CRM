import asyncio
from app.core.database import leads_col, users_col
async def fix():
    tl = await users_col.find_one({'email': 'tl@forgeindia.com'})
    await leads_col.update_many({'supervisor_id': None}, {'$set': {'supervisor_id': str(tl['_id'])}})
if __name__ == '__main__':
    asyncio.run(fix())
