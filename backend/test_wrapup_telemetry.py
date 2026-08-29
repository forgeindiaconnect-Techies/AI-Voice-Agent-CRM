import asyncio
import sys
import os
from datetime import datetime

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.routes.presence import (
    record_presence_change,
    handle_session_resync,
    handle_get_telemetry,
    users_col
)
from app.core.database import users_col, calls_col, attendance_col
from app.routes.calls import start_call, end_call, record_call_disposition
from app.schemas.common import CallStart, CallEnd, CallDispositionPayload
from bson import ObjectId
from fastapi import HTTPException


async def run_wrapup_telemetry_tests():
    print("\n==========================================================")
    print("   REAL-TIME CALL DISPOSITION & WRAP-UP TIMING TEST      ")
    print("==========================================================\n")

    # 1. Setup Test User & Lead
    test_user = await users_col.find_one({"role": "agent"})
    if not test_user:
        test_user_id = str(ObjectId())
        test_user = {
            "_id": ObjectId(test_user_id),
            "name": "Test WrapUp Agent",
            "role": "agent",
            "status": "offline",
            "session_version": 1
        }
        await users_col.insert_one(test_user)
    else:
        test_user_id = str(test_user["_id"])

    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    await calls_col.delete_many({"agent_id": {"$in": [test_user_id, ObjectId(test_user_id)]}})
    await attendance_col.delete_many({"agent_id": test_user_id, "date": today_str})
    await users_col.update_one(
        {"_id": ObjectId(test_user_id)},
        {"$set": {
            "status": "offline",
            "shift_date": today_str,
            "talk_seconds": 0,
            "dispose_seconds": 0,
            "total_calls_handled": 0
        }, "$unset": {"currentCallId": "", "dispositionStartedAt": ""}}
    )

    current_user_obj = {"_id": ObjectId(test_user_id), "id": test_user_id, "role": "agent", "name": "Test WrapUp Agent"}

    print(f"[INIT] Test Agent ID: {test_user_id}")

    # 2. Check in to establish active attendance session & move to READY
    from app.services.attendance_service import check_in_agent
    try:
        await check_in_agent(test_user_id)
    except ValueError:
        pass
    await record_presence_change(user_id=test_user_id, new_status="ready")
    print("[STEP 1] Agent moved to READY")

    # 3. Simulate Call End -> Move to WRAP_UP & check dispositionStartedAt
    fake_call_id = str(ObjectId())
    fake_call_doc = {
        "_id": ObjectId(fake_call_id),
        "agent_id": test_user_id,
        "pool_id": "general",
        "direction": "outbound",
        "status": "live",
        "started_at": datetime.utcnow()
    }
    await calls_col.insert_one(fake_call_doc)

    # Call /end
    end_payload = CallEnd(call_id=fake_call_id, outcome="answered", duration_seconds=45)
    end_res = await end_call(payload=end_payload)
    
    assert end_res["status"] == "wrap_up", f"Expected status 'wrap_up', got {end_res['status']}"
    assert "dispositionStartedAt" in end_res, "dispositionStartedAt missing from end_call response"
    print(f"[STEP 2] Call Ended -> Status = WRAP_UP | dispositionStartedAt = {end_res['dispositionStartedAt']}")

    # 4. Verify start_call is REJECTED while in WRAP_UP
    try:
        dummy_start = CallStart(lead_id=str(ObjectId()), direction="outbound")
        await start_call(payload=dummy_start, user=current_user_obj)
        print("[FAIL] start_call should have been rejected during WRAP_UP!")
    except HTTPException as e:
        assert e.status_code == 400
        print(f"[STEP 3] Rejection Verified: {e.detail}")

    # 5. Verify Session Resync includes dispositionStartedAt & activeWrapupSeconds
    await asyncio.sleep(1) # Let 1 second elapsed wrap-up time accrue
    resync_data = await handle_session_resync(current_user=current_user_obj)
    assert resync_data["raw_status"] == "wrap_up"
    assert resync_data["dispositionStartedAt"] is not None
    assert resync_data["activeWrapupSeconds"] >= 1
    print(f"[STEP 4] Resync Verified | Active Wrapup Seconds = {resync_data['activeWrapupSeconds']}")

    # 6. Submit Disposition (WRAP_UP -> READY)
    disp_payload = CallDispositionPayload(
        disposition="resolved",
        notes="Customer issue fully resolved during wrap-up period."
    )
    disp_res = await record_call_disposition(call_id=fake_call_id, payload=disp_payload, user=current_user_obj)

    assert disp_res["status"] == "dispositioned"
    assert disp_res["agent_status"] == "ready"
    assert "disposeDurationSeconds" in disp_res
    print(f"[STEP 5] Disposition Submitted | Dispose Duration = {disp_res['disposeDurationSeconds']}s | Agent Status = READY")

    # 7. Final Telemetry Verification
    telemetry_data = await handle_get_telemetry(current_user=current_user_obj)
    all_agent_calls = await calls_col.find({"agent_id": {"$in": [test_user_id, ObjectId(test_user_id)]}}).to_list(length=10)
    print(f"[DEBUG] telemetry_data: {telemetry_data}")
    print(f"[DEBUG] all_agent_calls count: {len(all_agent_calls)}, docs: {all_agent_calls}")
    assert telemetry_data["totalCalls"] == 1
    assert telemetry_data["disposeSeconds"] >= 1
    print(f"[STEP 6] Telemetry Verified | Dispose Time = {telemetry_data['disposeSeconds']}s | AHT = {telemetry_data['ahtFormatted']}")

    # 8. Reset Agent to OFFLINE
    await record_presence_change(user_id=test_user_id, new_status="offline", force_offline=True)
    print("[STEP 7] Agent set to OFFLINE")

    print("\n==========================================================")
    print("   ALL WRAP-UP TIMING & TELEMETRY TESTS PASSED! [OK]     ")
    print("==========================================================\n")


if __name__ == "__main__":
    asyncio.run(run_wrapup_telemetry_tests())
