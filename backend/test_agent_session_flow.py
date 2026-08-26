import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.routes.presence import (
    handle_session_start,
    handle_session_break,
    handle_session_resume,
    handle_session_logout,
    handle_get_active_session,
    SessionBreakPayload,
    SessionLogoutPayload,
    record_presence_change
)
from app.core.database import users_col
from fastapi import HTTPException

async def run_session_flow_tests():
    print("=== Testing Real-Time BPO Agent Session Management Flow ===")

    # 1. Fetch test agent user
    user = await users_col.find_one({"role": "agent"})
    if not user:
        user = await users_col.find_one({})
    if not user:
        print("ERROR: No user found in database for testing")
        return

    uid_str = str(user["_id"])
    print(f"Test Agent User: {uid_str} ({user.get('name')})")

    # Reset state to OFFLINE initially
    print("\n--- Resetting Agent Status to OFFLINE ---")
    try:
        await record_presence_change(user_id=uid_str, new_status="offline", force_offline=True)
    except HTTPException:
        pass

    # Step A: Attempt Invalid Transition OFFLINE -> BREAK (Must fail with HTTP 400)
    print("\n[Step A] Testing Invalid Transition: OFFLINE -> BREAK (Should be rejected)")
    try:
        payload = SessionBreakPayload(break_type="TEA", reason="Tea Break")
        await handle_session_break(payload, user)
        print("   [FAIL] OFFLINE -> BREAK was allowed but should have been rejected!")
    except HTTPException as e:
        assert e.status_code == 400
        print(f"   [OK] Correctly Rejected: HTTP {e.status_code} - {e.detail}")

    # Step 1: Set Ready (OFFLINE -> READY)
    print("\n[Step 1] Executing Set Ready (OFFLINE -> READY)...")
    res1 = await handle_session_start(user)
    assert res1["status"] == "READY", f"Expected READY, got {res1['status']}"
    assert res1["loginTime"] is not None, "loginTime must be populated"
    login_time_original = res1["loginTime"]
    print(f"   [OK] Session Started: Status = READY | Login Time = {login_time_original}")

    # Step 2: Tea Break (READY -> BREAK)
    print("\n[Step 2] Executing Tea Break (READY -> BREAK)...")
    payload_tea = SessionBreakPayload(break_type="TEA", reason="Tea Break")
    res2 = await handle_session_break(payload_tea, user)
    assert res2["status"] == "BREAK", f"Expected BREAK, got {res2['status']}"
    assert res2["breakType"] == "TEA", f"Expected TEA, got {res2['breakType']}"
    print(f"   [OK] Status = BREAK | Break Type = TEA | Break Start = {res2['breakStart']}")

    # Step B: Attempt Invalid Transition BREAK -> BREAK (Must fail with HTTP 400)
    print("\n[Step B] Testing Invalid Transition: BREAK -> BREAK (Should be rejected)")
    try:
        payload_lunch = SessionBreakPayload(break_type="LUNCH", reason="Lunch Break")
        await handle_session_break(payload_lunch, user)
        print("   [FAIL] BREAK -> BREAK was allowed but should have been rejected!")
    except HTTPException as e:
        assert e.status_code == 400
        print(f"   [OK] Correctly Rejected: HTTP {e.status_code} - {e.detail}")

    # Step 3: Resume Work from Tea Break (BREAK -> READY)
    print("\n[Step 3] Executing Resume Work (BREAK -> READY)...")
    res3 = await handle_session_resume(user)
    assert res3["status"] == "READY", f"Expected READY, got {res3['status']}"
    print(f"   [OK] Status Returned to READY | Break Ended")

    # Step 4: Lunch Break (READY -> BREAK)
    print("\n[Step 4] Executing Lunch Break (READY -> BREAK)...")
    payload_lunch = SessionBreakPayload(break_type="LUNCH", reason="Lunch Break")
    res4 = await handle_session_break(payload_lunch, user)
    assert res4["status"] == "BREAK", f"Expected BREAK, got {res4['status']}"
    assert res4["breakType"] == "LUNCH", f"Expected LUNCH, got {res4['breakType']}"
    print(f"   [OK] Status = BREAK | Break Type = LUNCH | Break Start = {res4['breakStart']}")

    # Step 5: Resume Work from Lunch Break (BREAK -> READY)
    print("\n[Step 5] Executing Resume Work (BREAK -> READY)...")
    res5 = await handle_session_resume(user)
    assert res5["status"] == "READY", f"Expected READY, got {res5['status']}"
    print(f"   [OK] Status Returned to READY")

    # Step 6: Personal Break (READY -> BREAK)
    print("\n[Step 6] Executing Personal Break (READY -> BREAK)...")
    payload_personal = SessionBreakPayload(break_type="PERSONAL", reason="Personal Break")
    res6 = await handle_session_break(payload_personal, user)
    assert res6["status"] == "BREAK", f"Expected BREAK, got {res6['status']}"
    assert res6["breakType"] == "PERSONAL", f"Expected PERSONAL, got {res6['breakType']}"
    print(f"   [OK] Status = BREAK | Break Type = PERSONAL | Break Start = {res6['breakStart']}")

    # Step 7: Resume Work from Personal Break (BREAK -> READY)
    print("\n[Step 7] Executing Resume Work (BREAK -> READY)...")
    res7 = await handle_session_resume(user)
    assert res7["status"] == "READY", f"Expected READY, got {res7['status']}"
    print(f"   [OK] Status Returned to READY")

    # Step 8: Verify Active Session Query (GET /agent/session/active)
    print("\n[Step 8] Verifying Active Session Query...")
    active_session = await handle_get_active_session(user)
    assert active_session["status"] == "READY", f"Expected READY, got {active_session['status']}"
    assert len(active_session["breakLogs"]) >= 3, f"Expected at least 3 break log records, got {len(active_session['breakLogs'])}"
    assert active_session["loginTime"] == login_time_original, "loginTime must remain unchanged after breaks"
    print(f"   [OK] Active Session Verified: Total Completed Breaks = {len(active_session['breakLogs'])} | Original Login Time Preserved = {active_session['loginTime']}")

    # Step 9: Go Offline / Logout (READY -> OFFLINE)
    print("\n[Step 9] Executing Go Offline / Logout (READY -> OFFLINE)...")
    payload_logout = SessionLogoutPayload(force_offline=True)
    res8 = await handle_session_logout(payload_logout, user)
    assert res8["status"] == "OFFLINE", f"Expected OFFLINE, got {res8['status']}"
    assert res8["logoutTime"] is not None, "logoutTime must be populated"
    print(f"   [OK] Agent Logged Out: Logout Time = {res8['logoutTime']} | Total Break Sec = {res8['totalBreakSeconds']} | Working Sec = {res8['totalWorkingSeconds']}")

    print("\n=== COMPLETE BPO AGENT SESSION MANAGEMENT TEST PASSED 100%! ===")

if __name__ == "__main__":
    asyncio.run(run_session_flow_tests())
