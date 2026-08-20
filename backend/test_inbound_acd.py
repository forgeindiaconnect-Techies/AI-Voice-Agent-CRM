import asyncio
import httpx
from app.main import app
from app.routes.calls import dispatch_next_queued_call
from app.core.database import users_col
from bson import ObjectId

async def main():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        print("--- Testing Inbound BPO ACD Flow (ASGI) ---")
        
        # 1. Dispatch Inbound Call (no ready agent initially)
        payload = {
            "phone": "9876543210",
            "name": "John Doe (Banking Customer)",
            "pool_id": "banking_customer_care",
            "auto_answer": True
        }
        res = await client.post("/api/calls/inbound/acd", json=payload)
        print("1. ACD Dispatch (Queued):", res.json())
        
        # 2. Find an agent and trigger status update to READY
        agent = await users_col.find_one({"role": "agent"})
        if agent:
            agent_id = str(agent["_id"])
            print(f"2. Triggering ACD Auto-Connect for Agent ID {agent_id} setting status to READY...")
            auto_call = await dispatch_next_queued_call(agent_id, "banking_customer_care")
            print("3. ACD Auto-Connected Call:", auto_call)
        else:
            print("No agent found in DB for test.")

if __name__ == "__main__":
    asyncio.run(main())
