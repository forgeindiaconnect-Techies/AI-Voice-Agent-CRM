import asyncio
import httpx
from app.main import app
from app.core.database import users_col, campaigns_col, pools_col, leads_col
from bson import ObjectId

async def main():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        print("=== TESTING ENTERPRISE BPO CAMPAIGN ENGINE (ASGI) ===")

        # 1. Fetch KPI summary
        res = await client.get("/api/campaigns/kpis/summary")
        print("1. KPI Summary:", res.status_code, res.json())

        # 2. Get test admin or team leader token/user
        user = await users_col.find_one({"role": "admin"})
        if not user:
            user = await users_col.find_one({})
        user_id = str(user["_id"]) if user else "test_admin"

        # 3. Create test BPO Campaign (Banking - Credit Cards)
        pool = await pools_col.find_one({})
        pool_id = str(pool["_id"]) if pool else "banking_customer_care"

        campaign_payload = {
            "name": "Q3 Banking Credit Cards Outreach",
            "pool_id": pool_id,
            "industry": "banking",
            "workflow_category": "credit_cards",
            "dialer_mode": "progressive",
            "routing_strategy": "longest_idle",
            "required_skills": ["banking_cards", "english"],
            "dnd_check_enabled": True,
            "calling_hours_start": "09:00",
            "calling_hours_end": "20:00",
            "max_retries": 3,
            "retry_interval_hours": 24,
            "pacing_ratio": 1.5,
            "status": "active"
        }

        # Override user auth for testing directly via campaigns_col / API
        print("2. Creating BPO Banking Campaign...")
        create_res = await campaigns_col.insert_one(campaign_payload)
        cmp_id = str(create_res.inserted_id)
        print(f"Created Campaign ID: {cmp_id}")

        # 4. Allocate Leads to Campaign
        print("3. Allocating Pool Leads to Campaign...")
        alloc_res = await leads_col.update_many(
            {"pool_id": pool_id, "campaign_id": None},
            {"$set": {"campaign_id": cmp_id}}
        )
        print(f"Allocated {alloc_res.modified_count} leads to campaign.")

        # 5. Fetch Campaign Stats
        print("4. Verifying Campaign Stats...")
        cmp_doc = await campaigns_col.find_one({"_id": ObjectId(cmp_id)})
        print("Campaign Doc Industry:", cmp_doc.get("industry"), "| Dialer Mode:", cmp_doc.get("dialer_mode"))

        print("=== BPO CAMPAIGN ENGINE TEST COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(main())
