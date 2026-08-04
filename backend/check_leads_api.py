import asyncio
from app.core.database import leads_col, users_col
from app.routes.leads import list_leads

async def main():
    priya = await users_col.find_one({"email": "tl@forgeindia.com"})
    print("PRIYA ROLE:", priya["role"])
    priya["id"] = str(priya["_id"])
    
    query = {}
    if priya["role"] == "agent":
        query["$or"] = [
            {"assigned_agent_id": str(priya["_id"])},
            {"created_by": str(priya["_id"])},
            {"assigned_agent_id": None}
        ]
        
    print("QUERY USED:", query)
    
    leads = []
    async for l in leads_col.find(query).sort("created_at", -1).limit(500):
        leads.append(l)
    print("LEADS RETURNED:", len(leads))

if __name__ == "__main__":
    asyncio.run(main())
