import asyncio
from app.core.database import leads_col, users_col
async def check():
    leads = await leads_col.find().to_list(None)
    for l in leads: print(f'Lead: {l.get("name")}, Pool: {l.get("pool_id")}, Sup: {l.get("supervisor_id")}')
    tl = await users_col.find_one({'email': 'tl@forgeindia.com'})
    print(f'TL Pool: {tl.get("pool_id")}, TL ID: {tl.get("_id")}')
if __name__ == '__main__':
    asyncio.run(check())
