import asyncio
import sys
from datetime import datetime, timezone

from app.core.database import init_indexes, attendance_col, attendance_breaks_col, holidays_col
from app.services.attendance_service import (
    get_today_attendance,
    check_in_agent,
    start_break,
    end_break,
    set_agent_offline,
    set_agent_online,
    check_out_agent,
    get_monthly_statistics,
    get_monthly_calendar,
    calculate_attendance_rate,
)

async def test_attendance():
    print("--- Starting Full Attendance State Machine Verification ---")
    await init_indexes()

    test_agent_id = "test_agent_full_state_99"

    # Cleanup
    await attendance_col.delete_many({"agent_id": test_agent_id})
    await attendance_breaks_col.delete_many({"agent_id": test_agent_id})

    # 1. Initial State
    today_data = await get_today_attendance(test_agent_id)
    print("1. Initial status:", today_data["operational_status"])
    assert today_data["operational_status"] in ("NOT_CHECKED_IN", "SUNDAY", "HOLIDAY")

    if today_data["operational_status"] == "NOT_CHECKED_IN":
        # 2. Check-In -> WORKING
        checkin_res = await check_in_agent(test_agent_id)
        print("2. Checked in -> Operational Status:", checkin_res["operational_status"])
        assert checkin_res["operational_status"] == "WORKING"

        # 3. Start Break -> BREAK
        break_res = await start_break(test_agent_id, "LUNCH")
        print("3. Start Lunch Break -> Operational Status:", break_res["operational_status"], "Current Break:", break_res["current_break"]["break_type"])
        assert break_res["operational_status"] == "BREAK"
        assert break_res["current_break"]["break_type"] == "LUNCH"

        # 4. Duplicate break attempt should fail
        try:
            await start_break(test_agent_id, "REFRESHMENT")
            print("ERROR: Duplicate break did NOT throw error!")
            sys.exit(1)
        except ValueError as ve:
            print("4. Duplicate break attempt properly blocked:", str(ve))

        # 5. End Break -> WORKING
        resume_res = await end_break(test_agent_id)
        print("5. Resume Work -> Operational Status:", resume_res["operational_status"], "Current Break:", resume_res["current_break"])
        assert resume_res["operational_status"] == "WORKING"
        assert resume_res["current_break"] is None

        # 6. Go Offline -> OFFLINE
        offline_res = await set_agent_offline(test_agent_id)
        print("6. Set Offline -> Operational Status:", offline_res["operational_status"])
        assert offline_res["operational_status"] == "OFFLINE"

        # 7. Go Online -> WORKING
        online_res = await set_agent_online(test_agent_id)
        print("7. Resume Online -> Operational Status:", online_res["operational_status"])
        assert online_res["operational_status"] == "WORKING"

        # 8. Check-out -> CHECKED_OUT
        checkout_res = await check_out_agent(test_agent_id)
        print("8. Check-out -> Operational Status:", checkout_res["operational_status"], "Check-out time:", checkout_res["check_out_time"])
        assert checkout_res["operational_status"] == "CHECKED_OUT"

    # Cleanup
    await attendance_col.delete_many({"agent_id": test_agent_id})
    await attendance_breaks_col.delete_many({"agent_id": test_agent_id})

    print("--- ALL ATTENDANCE STATE MACHINE TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    asyncio.run(test_attendance())
