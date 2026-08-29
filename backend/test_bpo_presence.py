import asyncio
import sys
import logging
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from app.core.database import users_col, agent_presence_col, agent_status_history_col
from app.core.utils import utcnow
from app.routes.presence import record_presence_change
from fastapi import HTTPException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_bpo_presence")

async def run_tests():
    logger.info("=== STARTING REAL-TIME BPO PRESENCE SYSTEM INTEGRATION TESTS ===")

    # 1. Setup Test User
    test_user_id = str(ObjectId())
    test_user = {
        "_id": ObjectId(test_user_id),
        "id": test_user_id,
        "name": "Test BPO Agent",
        "email": f"bpo_agent_{test_user_id}@test.com",
        "role": "agent",
        "status": "offline",
        "login_at": None,
        "logout_at": None,
        "last_status_change": None,
        "created_at": datetime.utcnow().isoformat()
    }
    await users_col.insert_one(test_user)
    logger.info(f"[PASS 1] Created test agent user: {test_user_id}")

    try:
        # 2. Test Invalid Transition: OFFLINE -> PAUSED (Should fail with 400)
        logger.info("Test 2: OFFLINE -> PAUSED (Expected Failure)...")
        try:
            await record_presence_change(user_id=test_user_id, new_status="paused", pause_reason="Tea Break")
            assert False, "Expected HTTPException 400 for invalid OFFLINE -> PAUSED transition!"
        except HTTPException as exc:
            assert exc.status_code == 400
            logger.info(f"[PASS 2] OFFLINE -> PAUSED correctly rejected: '{exc.detail}'")

        # 3. Test Valid Transition: Check In -> READY
        logger.info("Test 3: OFFLINE -> READY...")
        from app.services.attendance_service import check_in_agent
        await check_in_agent(test_user_id)
        res_ready = await record_presence_change(user_id=test_user_id, new_status="ready")
        assert res_ready is not None
        assert res_ready["status"].lower() == "ready"
        assert res_ready["login_at"] is not None
        logger.info(f"[PASS 3] OFFLINE -> READY succeeded. Status: {res_ready['status']}")

        # 4. Test Idempotent Duplicate Transition: READY -> READY
        logger.info("Test 4: READY -> READY (Idempotent No-Op)...")
        res_dup = await record_presence_change(user_id=test_user_id, new_status="ready")
        assert res_dup["status"].lower() == "ready"
        logger.info("[PASS 4] READY -> READY correctly handled as idempotent no-op.")

        # 5. Test Valid Transition: READY -> PAUSED (Lunch)
        logger.info("Test 5: READY -> PAUSED (Lunch)...")
        res_pause = await record_presence_change(user_id=test_user_id, new_status="paused", pause_reason="Lunch")
        assert res_pause["status"].lower() in ("paused", "break")
        assert res_pause["pause_reason"] == "Lunch"
        assert res_pause["current_break"] is not None
        logger.info(f"[PASS 5] READY -> PAUSED succeeded with reason '{res_pause['pause_reason']}'.")

        # 6. Test Valid Transition: PAUSED -> READY (Resume)
        logger.info("Test 6: PAUSED -> READY (Resume)...")
        res_resume = await record_presence_change(user_id=test_user_id, new_status="ready")
        assert res_resume["status"].lower() == "ready"
        assert len(res_resume["break_logs"]) >= 1
        logger.info(f"[PASS 6] PAUSED -> READY succeeded. Completed break logged with duration {res_resume['break_logs'][-1]['duration_seconds']}s.")

        # 7. Test Early Offline Rejection: READY -> OFFLINE without completing 8 Hours (force_offline=False)
        logger.info("Test 7: Early OFFLINE Rejection (Expected Failure)...")
        try:
            await record_presence_change(user_id=test_user_id, new_status="offline", force_offline=False)
            assert False, "Expected HTTPException 400 when attempting offline before completing 8 hours shift!"
        except HTTPException as exc:
            assert exc.status_code == 400
            logger.info(f"[PASS 7] Early offline correctly rejected: '{exc.detail}'")

        # 8. Test Max Break Limit Rejection (3780s / 1 hr 3 min)
        logger.info("Test 8: Max Break Limit Enforcement...")
        # Simulate completed break logs totaling >= 3780 seconds and login_at 3780s ago
        simulated_login = (utcnow() - timedelta(seconds=3780)).isoformat()
        await users_col.update_one(
            {"_id": ObjectId(test_user_id)},
            {"$set": {"login_at": simulated_login, "break_logs": [{"type": "Lunch Break", "start_time": "2026-08-25T10:00:00Z", "end_time": "2026-08-25T11:03:00Z", "duration_seconds": 3780}]}}
        )
        try:
            await record_presence_change(user_id=test_user_id, new_status="paused", pause_reason="Tea Break")
            assert False, "Expected HTTPException 400 when taking break after reaching max break limit!"
        except HTTPException as exc:
            assert exc.status_code == 400
            logger.info(f"[PASS 8] Break transition correctly rejected after reaching 1h 3m limit: '{exc.detail}'")

        # 9. Test Valid Force Offline: READY -> OFFLINE (force_offline=True)
        logger.info("Test 9: READY -> OFFLINE (force_offline=True)...")
        res_offline = await record_presence_change(user_id=test_user_id, new_status="offline", force_offline=True)
        assert res_offline["status"].lower() == "offline"
        assert res_offline["logout_at"] is not None
        assert res_offline["total_login_seconds"] == res_offline["total_ready_seconds"] + res_offline["total_pause_seconds"]
        assert res_offline["required_seconds"] == 28800
        logger.info(f"[PASS 9] READY -> OFFLINE succeeded with force_offline=True. Login HR ({res_offline['total_login_seconds']}s) = Ready ({res_offline['total_ready_seconds']}s) + Pause ({res_offline['total_pause_seconds']}s).")

        # 10. Check Database Persistence & Audit History
        logger.info("Test 10: Verify agent_status_history Database Log...")
        history_docs = await agent_status_history_col.find({"agent_id": test_user_id}).to_list(length=100)
        assert len(history_docs) >= 3
        logger.info(f"[PASS 10] Found {len(history_docs)} status transition audit records in database.")

        presence_doc = await agent_presence_col.find_one({"agent_id": test_user_id})
        assert presence_doc is not None
        assert presence_doc["status"].lower() == "offline"
        logger.info(f"[PASS 10] Authoritative agent_presence document verified in database.")


        logger.info("=== ALL BPO PRESENCE TESTS PASSED SUCCESSFULLY! ===")

    finally:
        # Cleanup
        await users_col.delete_one({"_id": ObjectId(test_user_id)})
        await agent_presence_col.delete_many({"agent_id": test_user_id})
        await agent_status_history_col.delete_many({"agent_id": test_user_id})
        logger.info("Test cleanup completed.")

if __name__ == "__main__":
    asyncio.run(run_tests())
