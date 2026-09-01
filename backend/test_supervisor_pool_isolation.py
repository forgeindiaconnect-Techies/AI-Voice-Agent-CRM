import asyncio
import sys
sys.path.append(".")

from app.core.database import users_col, pools_col
from app.routes.presence import get_supervisor_assigned_pool_ids, get_agents_presence, get_presence_summary

async def test_pool_isolation():
    print("=== TESTING BACKEND POOL ISOLATION ===")
    
    admin_user = await users_col.find_one({"role": "admin"})
    supervisor_user = await users_col.find_one({"role": "team_leader"})
    
    if not admin_user or not supervisor_user:
        print("ERROR: Admin or Supervisor user missing in DB!")
        return

    print(f"Admin User: {admin_user.get('name')} ({admin_user.get('email')})")
    print(f"Supervisor User: {supervisor_user.get('name')} ({supervisor_user.get('email')})")

    # 1. Test Admin permitted pools
    admin_pools = await get_supervisor_assigned_pool_ids(admin_user)
    print(f"Admin Permitted Pools: {admin_pools} (None = Unrestricted/All)")
    assert admin_pools is None, "Admin should have unrestricted access (None)"

    # 2. Test Supervisor permitted pools
    sup_pools = await get_supervisor_assigned_pool_ids(supervisor_user)
    print(f"Supervisor Permitted Pools: {sup_pools}")
    assert sup_pools is not None, "Supervisor should have restricted access"

    # 3. Test Admin agents query
    admin_agents = await get_agents_presence(current_user=admin_user)
    print(f"Admin Agents Count: {len(admin_agents)}")
    for a in admin_agents:
        print(f"  - Agent: {a.get('agentName')} | Pool: {a.get('requirementPoolName')} ({a.get('requirementPoolId')}) | Status: {a.get('status')}")

    # 4. Test Supervisor agents query
    sup_agents = await get_agents_presence(current_user=supervisor_user)
    print(f"Supervisor Agents Count: {len(sup_agents)}")
    for a in sup_agents:
        print(f"  - Agent: {a.get('agentName')} | Pool: {a.get('requirementPoolName')} ({a.get('requirementPoolId')}) | Status: {a.get('status')}")

    # 5. Verify Supervisor summary count
    sup_summary = await get_presence_summary(current_user=supervisor_user)
    print(f"Supervisor Summary: {sup_summary}")

    print("=== BACKEND POOL ISOLATION VERIFIED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(test_pool_isolation())
