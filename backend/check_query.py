import asyncio
from app.core.database import leads_col, users_col

async def main():
    # What does list_leads do exactly?
    user = await users_col.find_one({"email": "tl@forgeindia.com"})
    print("User role:", user.get("role"))
    query = {}
    uid = str(user["_id"])
    if user["role"] == "agent":
        query["$or"] = [
            {"assigned_agent_id": uid},
            {"created_by": uid},
            {"assigned_agent_id": None}
        ]
    print("Query:", query)
    leads = await leads_col.find(query).to_list(100)
    print("Direct MongoDB count:", len(leads))

if __name__ == "__main__":
    asyncio.run(main())
