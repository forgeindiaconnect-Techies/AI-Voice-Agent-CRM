import asyncio
from app.core.database import leads_col, users_col
async def fix():
    res = await users_col.update_many({'role': 'supervisor'}, {'$set': {'role': 'team_leader'}})
    print("Updated supervisor roles:", res.modified_count)
    tl = await users_col.find_one({'email': 'tl@forgeindia.com'})
    if tl:
        await leads_col.update_many({'supervisor_id': None}, {'$set': {'supervisor_id': str(tl['_id'])}})
if __name__ == '__main__':
    asyncio.run(fix())
