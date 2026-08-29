import asyncio
import logging
from datetime import datetime, timezone
import bson
from bson import ObjectId
from app.core.database import users_col, attendance_col, agent_shifts_col, calls_col
from app.core.utils import utcnow
from app.routes.presence import record_presence_change, record_call_completion

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_waiting_time")

async def run_waiting_time_tests():
    logger.info("=== STARTING POST-CALL WAITING TIME CALCULATION INTEGRATION TESTS ===")

    shift_date = utcnow().strftime("%Y-%m-%d")
    now_iso = utcnow().isoformat()

    # 1. Setup Test Agent
    agent_id = str(ObjectId())
    test_user = {
        "_id": ObjectId(agent_id),
        "id": agent_id,
        "name": "Test Waiting Agent",
        "email": f"waiting_agent_{agent_id[:6]}@forgeindia.com",
        "role": "agent",
        "status": "offline",
        "shift_date": shift_date,
        "login_at": None,
        "waiting_seconds": 0,
        "waiting_started_at": None,
        "created_at": now_iso
    }
    await users_col.insert_one(test_user)
    logger.info(f"[INIT] Created test agent user: {agent_id}")

    # Mark check-in for agent
    await attendance_col.insert_one({
        "agent_id": agent_id,
        "date": shift_date,
        "status": "PRESENT",
        "operational_status": "WORKING",
        "check_in_time": now_iso,
        "created_at": now_iso
    })

    try:
        # TEST 1: Check-In -> Ready (Starts Waiting Time Ticker)
        res1 = await record_presence_change(user_id=agent_id, new_status="ready", source="check_in")
        assert res1["status"] == "READY"
        assert res1["waiting_started_at"] is not None
        assert res1["waiting_seconds"] == 0
        logger.info(f"[PASS 1] Ready transition started waiting ticker: waiting_started_at={res1['waiting_started_at']}")

        # TEST 2: Start Call 1 (Transition to IN_CALL -> Freezes Waiting Time)
        # Simulate 2 seconds in READY before call starts
        await asyncio.sleep(2)
        res2 = await record_presence_change(user_id=agent_id, new_status="in_call", source="call_start")
        assert res2["status"] == "ON_CALL"
        assert res2["waiting_started_at"] is None
        assert res2["waiting_seconds"] >= 2
        waiting_after_call1_start = res2["waiting_seconds"]
        logger.info(f"[PASS 2] Call 1 start froze waiting time at: {waiting_after_call1_start}s")

        # TEST 3: End Call 1 -> Transition to WRAP_UP (Disposing)
        res3 = await record_presence_change(user_id=agent_id, new_status="wrap_up", source="call_end")
        assert res3["status"] == "WRAP_UP"
        assert res3["waiting_started_at"] is None
        assert res3["waiting_seconds"] == waiting_after_call1_start
        logger.info(f"[PASS 3] Wrap-up phase does NOT run waiting time (held at {res3['waiting_seconds']}s)")

        # TEST 4: Submit Disposition -> Transition to READY (Starts Post-Call Waiting Time)
        res4 = await record_presence_change(user_id=agent_id, new_status="ready", source="disposition_submit")
        assert res4["status"] == "READY"
        assert res4["waiting_started_at"] is not None
        logger.info(f"[PASS 4] Post-disposition Ready transition started new waiting period: {res4['waiting_started_at']}")

        # TEST 5: Wait 3 seconds, then test Idempotency (Duplicate READY call)
        await asyncio.sleep(3)
        res5 = await record_presence_change(user_id=agent_id, new_status="ready", source="duplicate_ready")
        assert res5["status"] == "READY"
        # Verify duplicate ready call did not wipe out waiting_started_at
        assert res5["waiting_started_at"] == res4["waiting_started_at"]
        logger.info(f"[PASS 5] Duplicate READY state update handled idempotently without resetting timestamp.")

        # TEST 6: Break Test -> Transition to PAUSED (Tea Break)
        await asyncio.sleep(2)
        res6 = await record_presence_change(user_id=agent_id, new_status="paused", pause_reason="Tea Break", source="user_break")
        assert res6["status"] == "BREAK"
        assert res6["waiting_started_at"] is None
        assert res6["waiting_seconds"] >= (waiting_after_call1_start + 4)
        waiting_after_break = res6["waiting_seconds"]
        logger.info(f"[PASS 6] Entering break froze waiting time at cumulative {waiting_after_break}s")

        # TEST 7: Resume from Break -> Transition to READY
        res7 = await record_presence_change(user_id=agent_id, new_status="ready", source="resume_break")
        assert res7["status"] == "READY"
        assert res7["waiting_started_at"] is not None
        logger.info(f"[PASS 7] Resuming from break started new post-break waiting ticker.")

        # TEST 8: Start Call 2 (Outbound/Inbound)
        await asyncio.sleep(2)
        res8 = await record_presence_change(user_id=agent_id, new_status="in_call", source="call_2_start")
        assert res8["status"] == "ON_CALL"
        assert res8["waiting_started_at"] is None
        assert res8["waiting_seconds"] >= (waiting_after_break + 2)
        final_cumulative_waiting = res8["waiting_seconds"]
        logger.info(f"[PASS 8] Call 2 start froze cumulative waiting time at {final_cumulative_waiting}s")

        logger.info("=== ALL POST-CALL WAITING TIME TESTS PASSED SUCCESSFULLY! ===")

    finally:
        # Cleanup
        await users_col.delete_one({"_id": ObjectId(agent_id)})
        await attendance_col.delete_many({"agent_id": agent_id})
        await agent_shifts_col.delete_many({"user_id": agent_id})
        logger.info("Test cleanup finished cleanly.")

if __name__ == "__main__":
    asyncio.run(run_waiting_time_tests())
