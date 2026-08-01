"""
Run once after starting MongoDB and the API to seed the 3 fixed pools
and demo Admin / Team Leader / Agent accounts (matching the workflow diagrams).

Usage:
    python seed.py
"""
import asyncio
from app.core.database import users_col, pools_col
from app.core.security import hash_password
from app.core.utils import gen_employee_id, utcnow


POOLS = ["recruitment", "credit_card_sales", "customer_support"]

DEMO_USERS = [
    {"name": "Admin User", "email": "admin@forgeindia.com", "password": "Admin@123", "role": "admin"},
    {"name": "Supervisor Priya", "email": "tl@forgeindia.com", "password": "Leader@123", "role": "team_leader"},
    {"name": "Agent Ramesh", "email": "agent@forgeindia.com", "password": "Agent@123", "role": "agent"},
]


async def seed():
    pool_ids = {}
    for name in POOLS:
        existing = await pools_col.find_one({"name": name})
        if existing:
            pool_ids[name] = str(existing["_id"])
            continue
        result = await pools_col.insert_one({"name": name, "description": f"{name} pool", "created_at": utcnow()})
        pool_ids[name] = str(result.inserted_id)
        print(f"Created pool: {name}")

    for u in DEMO_USERS:
        if await users_col.find_one({"email": u["email"]}):
            print(f"User already exists: {u['email']}")
            continue
        doc = dict(u)
        doc["password"] = hash_password(doc["password"])
        doc["employee_id"] = gen_employee_id(doc["role"])
        doc["is_active"] = True
        doc["created_at"] = utcnow()
        if doc["role"] != "admin":
            doc["pool_id"] = pool_ids["credit_card_sales"]
        await users_col.insert_one(doc)
        print(f"Created user: {u['email']} / {u['password']}")

    print("\nSeed complete. Login with the demo accounts above.")


if __name__ == "__main__":
    asyncio.run(seed())
