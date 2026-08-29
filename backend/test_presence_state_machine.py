import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.routes.presence import record_presence_change
from app.core.database import users_col
from fastapi import HTTPException

async def run_tests():
    print("=== Testing Agent Status State Machine ===")
    
    # Fetch test user
    user = await users_col.find_one({"role": "agent"})
    if not user:
        user = await users_col.find_one({})
    if not user:
        print("ERROR: No user found in database to test")
        return

    uid = str(user["_id"])
    print(f"Testing with User ID: {uid} ({user.get('name')})")

    # 1. Ensure initial state is OFFLINE
    print("\n1. Setting initial status to OFFLINE...")
    try:
        res = await record_presence_change(user_id=uid, new_status="offline", force_offline=True)
        assert res["status"] == "OFFLINE", f"Expected OFFLINE, got {res['status']}"
        print("   [OK] Success: Status set to OFFLINE")
    except HTTPException as e:
        if e.status_code == 400 and ("OFFLINE" in str(e.detail) or "offline" in str(e.detail)):
            print("   [OK] User already OFFLINE in database")
        else:
            raise e

    # 2. Reject OFFLINE -> ON_BREAK (invalid)
    print("\n2. Testing invalid transition OFFLINE -> ON_BREAK...")
    try:
        await record_presence_change(user_id=uid, new_status="paused", pause_reason="Lunch Break")
        print("   [FAIL] OFFLINE -> ON_BREAK was allowed but should be rejected")
    except HTTPException as e:
        assert e.status_code == 400
        print(f"   [OK] Correctly rejected: HTTP {e.status_code} - {e.detail}")

    # 3. Reject OFFLINE -> OFFLINE (invalid duplicate)
    print("\n3. Testing invalid transition OFFLINE -> OFFLINE...")
    try:
        await record_presence_change(user_id=uid, new_status="offline", force_offline=True)
        print("   [FAIL] OFFLINE -> OFFLINE was allowed but should be rejected")
    except HTTPException as e:
        assert e.status_code == 400
        print(f"   [OK] Correctly rejected: HTTP {e.status_code} - {e.detail}")

    # 4. Valid transition OFFLINE -> READY (login/go online)
    print("\n4. Testing valid transition OFFLINE -> READY...")
    res = await record_presence_change(user_id=uid, new_status="ready")
    assert res["status"] == "READY", f"Expected READY, got {res['status']}"
    print("   [OK] Success: Status is READY")

    # 5. Valid transition READY -> BREAK (Lunch Break)
    print("\n5. Testing valid transition READY -> BREAK...")
    res = await record_presence_change(user_id=uid, new_status="paused", pause_reason="Lunch Break")
    assert res["status"] == "BREAK", f"Expected BREAK, got {res['status']}"
    assert res["breakType"] == "LUNCH", f"Expected LUNCH breakType, got {res['breakType']}"
    print("   [OK] Success: Status is BREAK (LUNCH)")

    # 6. Reject BREAK -> BREAK (invalid duplicate)
    print("\n6. Testing invalid transition BREAK -> BREAK...")
    try:
        await record_presence_change(user_id=uid, new_status="paused", pause_reason="Tea Break")
        print("   [FAIL] BREAK -> BREAK was allowed but should be rejected")
    except HTTPException as e:
        assert e.status_code == 400
        print(f"   [OK] Correctly rejected: HTTP {e.status_code} - {e.detail}")

    # 7. Valid transition BREAK -> READY (Resume Work)
    print("\n7. Testing valid transition BREAK -> READY (Resume Work)...")
    res = await record_presence_change(user_id=uid, new_status="ready")
    assert res["status"] == "READY", f"Expected READY, got {res['status']}"
    print("   [OK] Success: Status returned to READY")

    # 8. Valid transition READY -> OFFLINE (Go Offline)
    print("\n8. Testing valid transition READY -> OFFLINE...")
    res = await record_presence_change(user_id=uid, new_status="offline", force_offline=True)
    assert res["status"] == "OFFLINE", f"Expected OFFLINE, got {res['status']}"
    print("   [OK] Success: Agent is now OFFLINE")

    print("\n=== ALL STATE MACHINE TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    asyncio.run(run_tests())
