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
    handle_session_heartbeat,
    handle_session_resync,
    handle_get_telemetry,
    SessionBreakPayload,
    SessionLogoutPayload,
    SessionHeartbeatPayload,
    record_presence_change
)
from app.core.database import users_col
from fastapi import HTTPException

async def run_bpo_telemetry_tests():
    print("==========================================================")
    print("   BPO REAL-TIME SESSION TELEMETRY & STATE MACHINE TEST   ")
    print("==========================================================")

    # 1. Fetch test agent user
    user = await users_col.find_one({"role": "agent"})
    if not user:
        user = await users_col.find_one({})
    if not user:
        print("❌ ERROR: No user found in database for testing")
        return

    uid_str = str(user["_id"])
    print(f"\n[INIT] Test Agent User: {uid_str} ({user.get('name')})")

    # Reset state to OFFLINE initially
    print("1. Resetting Agent Status to OFFLINE...")
    try:
        await record_presence_change(user_id=uid_str, new_status="offline", force_offline=True)
        print("   [OK] Agent set to OFFLINE")
    except HTTPException:
        print("   [OK] Agent already OFFLINE")

    # 2. Test Invalid Transition: OFFLINE -> ON_CALL (Must fail with 400)
    print("\n2. Testing Invalid Transition: OFFLINE -> ON_CALL...")
    try:
        await record_presence_change(user_id=uid_str, new_status="in_call")
        print("   [FAIL] OFFLINE -> ON_CALL was allowed but should be rejected")
    except HTTPException as e:
        assert e.status_code == 400
        print(f"   [OK] Correctly rejected with HTTP {e.status_code} - {e.detail}")

    # 3. Test Invalid Transition: OFFLINE -> WRAP_UP (Must fail with 400)
    print("\n3. Testing Invalid Transition: OFFLINE -> WRAP_UP...")
    try:
        await record_presence_change(user_id=uid_str, new_status="wrap_up")
        print("   [FAIL] OFFLINE -> WRAP_UP was allowed but should be rejected")
    except HTTPException as e:
        assert e.status_code == 400
        print(f"   [OK] Correctly rejected with HTTP {e.status_code} - {e.detail}")

    # 4. Valid Session Start: OFFLINE -> READY
    print("\n4. Testing Session Start (OFFLINE -> READY)...")
    res1 = await handle_session_start(user)
    assert res1["status"] == "READY"
    print(f"   [OK] Status = {res1['status']} | Login Time = {res1['loginTime']}")

    # 5. Break Transitions (Lunch, Tea, Personal, Other)
    print("\n5. Testing Break Categories (Lunch, Tea, Personal, Other)...")
    
    # 5a. Lunch Break
    p_lunch = SessionBreakPayload(break_type="LUNCH", reason="Lunch Break")
    b_lunch = await handle_session_break(p_lunch, user)
    assert b_lunch["status"] == "BREAK"
    assert b_lunch["breakType"] == "LUNCH"
    print("   [OK] Lunch Break started successfully")

    # Resume from Lunch Break
    res_lunch = await handle_session_resume(user)
    assert res_lunch["status"] == "READY"
    print("   [OK] Resumed to READY from Lunch Break")

    # 5b. Other Break
    p_other = SessionBreakPayload(break_type="OTHER", reason="Admin / Briefing Break")
    b_other = await handle_session_break(p_other, user)
    assert b_other["status"] == "BREAK"
    assert b_other["breakType"] == "OTHER"
    print("   [OK] Other Break started successfully")

    # Resume from Other Break
    res_other = await handle_session_resume(user)
    assert res_other["status"] == "READY"
    print("   [OK] Resumed to READY from Other Break")

    # 6. Test Invalid Transition: BREAK -> RINGING (Must fail with 400)
    print("\n6. Testing Invalid Transition: BREAK -> RINGING...")
    # First set to break
    await handle_session_break(SessionBreakPayload(break_type="TEA", reason="Tea Break"), user)
    try:
        await record_presence_change(user_id=uid_str, new_status="ringing")
        print("   [FAIL] BREAK -> RINGING was allowed but should be rejected")
    except HTTPException as e:
        assert e.status_code == 400
        print(f"   [OK] Correctly rejected with HTTP {e.status_code} - {e.detail}")

    # Resume to READY
    await handle_session_resume(user)

    # 7. Test Call Workflow: READY -> RINGING -> ON_CALL -> WRAP_UP -> READY
    print("\n7. Testing Full Call Telemetry Workflow (READY -> RINGING -> ON_CALL -> WRAP_UP -> READY)...")
    
    # 7a. READY -> RINGING
    res_ring = await record_presence_change(user_id=uid_str, new_status="ringing")
    assert res_ring["status"] == "RINGING"
    print("   [OK] Status = RINGING")

    # 7b. RINGING -> ON_CALL
    res_call = await record_presence_change(user_id=uid_str, new_status="in_call")
    assert res_call["status"] == "ON_CALL"
    print("   [OK] Status = ON_CALL")

    # 7c. ON_CALL -> WRAP_UP
    res_wrap = await record_presence_change(user_id=uid_str, new_status="wrap_up")
    assert res_wrap["status"] == "WRAP_UP"
    print("   [OK] Status = WRAP_UP")

    # 7d. WRAP_UP -> READY
    res_ready_after_call = await record_presence_change(user_id=uid_str, new_status="ready")
    assert res_ready_after_call["status"] == "READY"
    print("   [OK] Status = READY (Call & Wrapup Complete)")

    # 8. Test Session Heartbeat Endpoint
    print("\n8. Testing Session Heartbeat Endpoint (POST /api/agent/session/heartbeat)...")
    hb_res = await handle_session_heartbeat(SessionHeartbeatPayload(session_id="test_sess"), user)
    assert hb_res["success"] is True
    print(f"   [OK] Heartbeat Acknowledged | Server Timestamp = {hb_res['serverTimestamp']}")

    # 9. Test Session Resync Endpoint
    print("\n9. Testing Session Resync Endpoint (GET /api/agent/session/resync)...")
    sync_res = await handle_session_resync(user)
    assert sync_res["event"] == "agent.session.synced"
    assert sync_res["status"] == "READY"
    assert "totalReadySeconds" in sync_res
    print(f"   [OK] Resync Received | Total Ready Sec = {sync_res['totalReadySeconds']} | Session Version = {sync_res['sessionVersion']}")

    # 10. Test Telemetry Endpoint
    print("\n10. Testing Telemetry Endpoint (GET /api/agent/session/telemetry)...")
    telem_res = await handle_get_telemetry(user)
    assert "ahtSeconds" in telem_res
    assert "ahtFormatted" in telem_res
    print(f"   [OK] Telemetry Verified | AHT = {telem_res['ahtFormatted']} | Total Calls = {telem_res['totalCalls']}")

    # 11. Go Offline / Session Logout
    print("\n11. Testing Go Offline / Session Logout (READY -> OFFLINE)...")
    logout_res = await handle_session_logout(SessionLogoutPayload(force_offline=True), user)
    assert logout_res["status"] == "OFFLINE"
    print(f"   [OK] Session Logged Out Successfully at {logout_res['logoutTime']}")

    print("\n==========================================================")
    print("   ALL BPO SESSION TELEMETRY & STATE MACHINE TESTS PASSED! ")
    print("==========================================================")

if __name__ == "__main__":
    asyncio.run(run_bpo_telemetry_tests())
