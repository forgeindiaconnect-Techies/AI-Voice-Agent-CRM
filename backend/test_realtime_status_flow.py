import asyncio
import sys
sys.path.append(".")

from app.core.database import users_col
from app.routes.presence import record_presence_change

async def test_realtime_flow():
    print("=== TESTING REALTIME STATUS & VERSION FLOW ===")
    
    agent = await users_col.find_one({"role": "agent"})
    if not agent:
        print("No agent found in database")
        return
        
    uid_str = str(agent["_id"])
    print(f"Testing Agent: {agent.get('name')} (ID: {uid_str}) | Current Status: {agent.get('status')} | Version: {agent.get('version', 0)}")

    # 1. Set Ready
    res1 = await record_presence_change(user_id=uid_str, new_status="ready", source="test")
    u1 = await users_col.find_one({"_id": agent["_id"]})
    print(f"--> Transition to READY: status={u1.get('status')} | version={u1.get('version')} | WS version={res1.get('version')}")
    assert u1.get("status") == "ready"
    assert res1.get("version") == u1.get("version")

    # 2. Set Break (Pause)
    res2 = await record_presence_change(user_id=uid_str, new_status="paused", pause_reason="Tea Break", source="test")
    u2 = await users_col.find_one({"_id": agent["_id"]})
    print(f"--> Transition to PAUSED (Break): status={u2.get('status')} | version={u2.get('version')} | WS version={res2.get('version')}")
    assert u2.get("status") == "paused"
    assert u2.get("version") > u1.get("version")

    # 3. Set Ready
    res3 = await record_presence_change(user_id=uid_str, new_status="ready", source="test")
    u3 = await users_col.find_one({"_id": agent["_id"]})
    print(f"--> Transition back to READY: status={u3.get('status')} | version={u3.get('version')} | WS version={res3.get('version')}")
    assert u3.get("status") == "ready"
    assert u3.get("version") > u2.get("version")

    print("=== REALTIME STATUS & VERSION FLOW TEST PASSED ===")

if __name__ == "__main__":
    asyncio.run(test_realtime_flow())
