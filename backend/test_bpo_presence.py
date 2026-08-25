import asyncio
import sys
import logging
from datetime import datetime
from bson import ObjectId
from app.core.database import users_col, agent_presence_col, agent_status_history_col
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

        # 3. Test Valid Transition: OFFLINE -> READY
        logger.info("Test 3: OFFLINE -> READY...")
        res_ready = await record_presence_change(user_id=test_user_id, new_status="ready")
        assert res_ready is not None
        assert res_ready["status"] == "ready"
        assert res_ready["login_at"] is not None
        logger.info(f"[PASS 3] OFFLINE -> READY succeeded. Status: {res_ready['status']}")

        # 4. Test Idempotent Duplicate Transition: READY -> READY
        logger.info("Test 4: READY -> READY (Idempotent No-Op)...")
        res_dup = await record_presence_change(user_id=test_user_id, new_status="ready")
        assert res_dup["status"] == "ready"
        logger.info("[PASS 4] READY -> READY correctly handled as idempotent no-op.")

        # 5. Test Valid Transition: READY -> PAUSED (Lunch)
        logger.info("Test 5: READY -> PAUSED (Lunch)...")
        res_pause = await record_presence_change(user_id=test_user_id, new_status="paused", pause_reason="Lunch")
        assert res_pause["status"] == "paused"
        assert res_pause["pause_reason"] == "Lunch"
        assert res_pause["current_break"] is not None
        logger.info(f"[PASS 5] READY -> PAUSED succeeded with reason '{res_pause['pause_reason']}'.")

        # 6. Test Valid Transition: PAUSED -> READY (Resume)
        logger.info("Test 6: PAUSED -> READY (Resume)...")
        res_resume = await record_presence_change(user_id=test_user_id, new_status="ready")
        assert res_resume["status"] == "ready"
        assert len(res_resume["break_logs"]) >= 1
        logger.info(f"[PASS 6] PAUSED -> READY succeeded. Completed break logged with duration {res_resume['break_logs'][-1]['duration_seconds']}s.")

        # 7. Test Valid Transition: READY -> OFFLINE
        logger.info("Test 7: READY -> OFFLINE...")
        res_offline = await record_presence_change(user_id=test_user_id, new_status="offline", force_offline=True)
        assert res_offline["status"] == "offline"
        assert res_offline["logout_at"] is not None
        assert res_offline["total_login_seconds"] == res_offline["total_ready_seconds"] + res_offline["total_pause_seconds"]
        assert res_offline["required_seconds"] == 28800
        logger.info(f"[PASS 7] READY -> OFFLINE succeeded. Login HR ({res_offline['total_login_seconds']}s) = Ready ({res_offline['total_ready_seconds']}s) + Pause ({res_offline['total_pause_seconds']}s).")

        # 8. Check Database Persistence & Audit History
        logger.info("Test 8: Verify agent_status_history Database Log...")
        history_docs = await agent_status_history_col.find({"agent_id": test_user_id}).to_list(length=100)
        assert len(history_docs) >= 4
        logger.info(f"[PASS 8] Found {len(history_docs)} status transition audit records in database.")

        presence_doc = await agent_presence_col.find_one({"agent_id": test_user_id})
        assert presence_doc is not None
        assert presence_doc["status"] == "offline"
        logger.info(f"[PASS 8] Authoritative agent_presence document verified in database.")


        logger.info("=== ALL BPO PRESENCE TESTS PASSED SUCCESSFULLY! ===")

    finally:
        # Cleanup
        await users_col.delete_one({"_id": ObjectId(test_user_id)})
        await agent_presence_col.delete_many({"agent_id": test_user_id})
        await agent_status_history_col.delete_many({"agent_id": test_user_id})
        logger.info("Test cleanup completed.")

if __name__ == "__main__":
    asyncio.run(run_tests())
