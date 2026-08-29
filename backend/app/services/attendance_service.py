import calendar
import logging
from datetime import datetime, timezone, timedelta, date as d_date
from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.core.database import attendance_col, attendance_breaks_col, holidays_col, users_col, agent_presence_col
from app.core.utils import utcnow, oid_str

logger = logging.getLogger("uvicorn.error")

# Configurable Attendance & Shift Rules
TZ_OFFSET = timedelta(hours=5, minutes=30)  # IST timezone (+05:30)
FULL_DAY_MINUTES = 480                      # 8 Hours
HALF_DAY_MINUTES = 240                      # 4 Hours
DEFAULT_OFFICE_LOCATION = "Krishnagiri Office"

# Allowed break categories
VALID_BREAK_TYPES = {"REFRESHMENT", "LUNCH", "PERSONAL"}


def get_local_now() -> datetime:
    """Return current datetime localized to organization timezone (+05:30)."""
    return datetime.now(timezone.utc).astimezone(timezone(TZ_OFFSET))


def get_local_date_str(dt: datetime | None = None) -> str:
    """Format a datetime into YYYY-MM-DD string according to local timezone."""
    if dt is None:
        dt = get_local_now()
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(timezone(TZ_OFFSET))
    else:
        dt = dt.astimezone(timezone(TZ_OFFSET))
    return dt.strftime("%Y-%m-%d")


def is_sunday(date_str: str) -> bool:
    """Check if the given YYYY-MM-DD string is a Sunday."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    return dt.weekday() == 6


async def get_holidays_map(year: int | None = None) -> dict[str, str]:
    """Fetch holidays dictionary mapping date string 'YYYY-MM-DD' -> holiday name."""
    query = {}
    if year:
        query["date"] = {"$regex": f"^{year}-"}
    cursor = holidays_col.find(query)
    holidays = {}
    async for h in cursor:
        holidays[h["date"]] = h.get("name", "Holiday")
    return holidays


def calculate_attendance_status(total_work_minutes: int) -> str:
    """Derive final status from net work duration."""
    if total_work_minutes >= FULL_DAY_MINUTES:
        return "PRESENT"
    elif total_work_minutes >= HALF_DAY_MINUTES:
        return "HALF_DAY"
    else:
        return "ABSENT"


def calculate_attendance_rate(present_count: int, half_day_count: int, required_days: int) -> float:
    """
    Attendance Rate = ((Present * 1.0) + (HalfDay * 0.5)) / RequiredWorkingDays * 100
    Excludes Sundays and Holidays from denominator.
    """
    if required_days <= 0:
        return 100.0
    rate = ((present_count * 1.0) + (half_day_count * 0.5)) / required_days * 100.0
    return round(min(100.0, max(0.0, rate)), 1)


async def sync_user_presence(
    agent_id: str,
    status_str: str,
    login_at: str | None = None,
    logout_at: str | None = None,
    pause_reason: str | None = None,
    current_break: dict | None = None,
):
    """Synchronize user presence records in users_col and agent_presence_col."""
    now_dt = utcnow()
    today_str = get_local_date_str(now_dt)
    user_query = {"_id": ObjectId(agent_id)} if ObjectId.is_valid(agent_id) else {"id": agent_id}

    update_doc: dict = {
        "status": status_str,
        "last_status_change": now_dt.isoformat(),
        "updated_at": now_dt,
    }
    if login_at is not None:
        update_doc["login_at"] = login_at
        update_doc["shift_date"] = today_str
    if logout_at is not None:
        update_doc["logout_at"] = logout_at
    if pause_reason is not None or status_str == "ready":
        update_doc["pause_reason"] = pause_reason
    if current_break is not None or status_str == "ready":
        update_doc["current_break"] = current_break

    await users_col.update_one(user_query, {"$set": update_doc})

    presence_doc = {
        "agent_id": agent_id,
        "user_id": agent_id,
        **update_doc,
    }
    await agent_presence_col.update_one(
        {"agent_id": agent_id},
        {"$set": presence_doc},
        upsert=True
    )


async def get_today_attendance(agent_id: str) -> dict:
    """Fetch today's attendance record along with break details and operational status."""
    today_str = get_local_date_str()
    record = await attendance_col.find_one({"agent_id": agent_id, "date": today_str})

    if record:
        att_id = str(record["_id"])
        
        # Check active break
        active_break = await attendance_breaks_col.find_one({"agent_id": agent_id, "status": "ACTIVE"})
        
        # Fetch completed breaks for this session
        cursor = attendance_breaks_col.find({"attendance_id": att_id, "status": "COMPLETED"})
        completed_breaks = [oid_str(b) async for b in cursor]

        # Total completed break minutes
        total_break_mins = sum(b.get("duration_minutes", 0) for b in completed_breaks)

        # Operational status resolution
        op_status = record.get("operational_status")
        if record.get("check_out_time") or record.get("status") in ("CHECKED_OUT", "COMPLETED"):
            op_status = "CHECKED_OUT"
        elif active_break:
            op_status = "BREAK"
        elif not op_status:
            op_status = "WORKING"

        res = oid_str(record)
        res["operational_status"] = op_status
        res["total_break_minutes"] = total_break_mins
        res["current_break"] = oid_str(active_break) if active_break else None
        res["completed_breaks"] = completed_breaks
        return res

    # Check Sunday or Holiday
    holidays = await get_holidays_map()
    if is_sunday(today_str):
        return {
            "agent_id": agent_id,
            "date": today_str,
            "status": "SUNDAY",
            "operational_status": "SUNDAY",
            "check_in_time": None,
            "check_out_time": None,
            "total_work_minutes": 0,
            "total_break_minutes": 0,
            "location": DEFAULT_OFFICE_LOCATION,
        }

    if today_str in holidays:
        return {
            "agent_id": agent_id,
            "date": today_str,
            "status": "HOLIDAY",
            "operational_status": "HOLIDAY",
            "holiday_name": holidays[today_str],
            "check_in_time": None,
            "check_out_time": None,
            "total_work_minutes": 0,
            "total_break_minutes": 0,
            "location": DEFAULT_OFFICE_LOCATION,
        }

    return {
        "agent_id": agent_id,
        "date": today_str,
        "status": "NOT_CHECKED_IN",
        "operational_status": "NOT_CHECKED_IN",
        "check_in_time": None,
        "check_out_time": None,
        "total_work_minutes": 0,
        "total_break_minutes": 0,
        "location": DEFAULT_OFFICE_LOCATION,
    }


async def check_in_agent(agent_id: str, location: str = DEFAULT_OFFICE_LOCATION) -> dict:
    """Process agent check-in with database-level uniqueness enforcement."""
    today_str = get_local_date_str()

    if is_sunday(today_str):
        raise ValueError("Sunday attendance check-in is not permitted.")

    holidays = await get_holidays_map()
    if today_str in holidays:
        raise ValueError(f"Today is a holiday ({holidays[today_str]}). Check-in is not permitted.")

    existing = await attendance_col.find_one({"agent_id": agent_id, "date": today_str})
    if existing:
        raise ValueError("Agent is already checked in today.")

    now_dt = utcnow()
    now_iso = now_dt.isoformat()
    doc = {
        "agent_id": agent_id,
        "date": today_str,
        "status": "PRESENT",
        "operational_status": "WORKING",
        "check_in_time": now_iso,
        "check_out_time": None,
        "total_work_minutes": 0,
        "total_break_minutes": 0,
        "location": location or DEFAULT_OFFICE_LOCATION,
        "created_at": now_dt,
        "updated_at": now_dt,
    }

    try:
        res = await attendance_col.insert_one(doc)
        doc["_id"] = res.inserted_id

        # Synchronize presence & start BPO Session from check-in time
        await sync_user_presence(
            agent_id=agent_id,
            status_str="ready",
            login_at=now_iso,
            logout_at=None,
            pause_reason=None,
            current_break=None,
        )

        return oid_str(doc)
    except DuplicateKeyError:
        raise ValueError("Agent is already checked in today.")


async def start_break(agent_id: str, break_type: str) -> dict:
    """Start an active break session (REFRESHMENT, LUNCH, PERSONAL)."""
    norm_break_type = str(break_type).upper().strip()
    if norm_break_type not in VALID_BREAK_TYPES:
        raise ValueError(f"Invalid break type: '{break_type}'. Must be REFRESHMENT, LUNCH, or PERSONAL.")

    today_str = get_local_date_str()
    record = await attendance_col.find_one({"agent_id": agent_id, "date": today_str})

    if not record:
        raise ValueError("You must check in before pausing for a break.")

    if record.get("check_out_time") or record.get("status") in ("CHECKED_OUT", "COMPLETED"):
        raise ValueError("Attendance is already checked out for today.")

    active_break = await attendance_breaks_col.find_one({"agent_id": agent_id, "status": "ACTIVE"})
    if active_break:
        raise ValueError("You are already on an active break.")

    now_dt = utcnow()
    now_iso = now_dt.isoformat()
    att_id = str(record["_id"])

    break_doc = {
        "attendance_id": att_id,
        "agent_id": agent_id,
        "break_type": norm_break_type,
        "start_time": now_iso,
        "end_time": None,
        "duration_minutes": 0,
        "status": "ACTIVE",
        "created_at": now_dt,
        "updated_at": now_dt,
    }

    res = await attendance_breaks_col.insert_one(break_doc)
    break_doc["_id"] = res.inserted_id

    curr_break_obj = {
        "break_type": norm_break_type,
        "start_time": now_iso,
    }

    await attendance_col.update_one(
        {"_id": record["_id"]},
        {
            "$set": {
                "operational_status": "BREAK",
                "current_break": curr_break_obj,
                "updated_at": now_dt,
            }
        },
    )

    # Sync presence to paused
    await sync_user_presence(
        agent_id=agent_id,
        status_str="paused",
        pause_reason=norm_break_type,
        current_break=curr_break_obj,
    )

    return await get_today_attendance(agent_id)


async def end_break(agent_id: str) -> dict:
    """End the active break session and resume working state."""
    active_break = await attendance_breaks_col.find_one({"agent_id": agent_id, "status": "ACTIVE"})
    if not active_break:
        raise ValueError("No active break found to resume work.")

    now_dt = utcnow()
    now_iso = now_dt.isoformat()
    start_time_str = active_break.get("start_time")
    
    if start_time_str:
        try:
            start_dt = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
        except Exception:
            start_dt = now_dt
        elapsed_sec = (now_dt - start_dt).total_seconds()
        duration_mins = max(0, int(elapsed_sec // 60))
    else:
        duration_mins = 0

    await attendance_breaks_col.update_one(
        {"_id": active_break["_id"]},
        {
            "$set": {
                "end_time": now_iso,
                "duration_minutes": duration_mins,
                "status": "COMPLETED",
                "updated_at": now_dt,
            }
        },
    )

    today_str = get_local_date_str()
    record = await attendance_col.find_one({"agent_id": agent_id, "date": today_str})

    if record:
        att_id = str(record["_id"])
        cursor = attendance_breaks_col.find({"attendance_id": att_id, "status": "COMPLETED"})
        completed_breaks = [b async for b in cursor]
        total_break_mins = sum(b.get("duration_minutes", 0) for b in completed_breaks)

        await attendance_col.update_one(
            {"_id": record["_id"]},
            {
                "$set": {
                    "operational_status": "WORKING",
                    "current_break": None,
                    "total_break_minutes": total_break_mins,
                    "updated_at": now_dt,
                }
            },
        )

    # Sync presence to ready
    await sync_user_presence(
        agent_id=agent_id,
        status_str="ready",
        pause_reason=None,
        current_break=None,
    )

    return await get_today_attendance(agent_id)


async def set_agent_offline(agent_id: str) -> dict:
    """Switch operational status to OFFLINE while keeping attendance active."""
    today_str = get_local_date_str()
    record = await attendance_col.find_one({"agent_id": agent_id, "date": today_str})
    if not record:
        raise ValueError("No check-in record found for today.")

    if record.get("check_out_time") or record.get("status") in ("CHECKED_OUT", "COMPLETED"):
        raise ValueError("Attendance is already checked out today.")

    now_dt = utcnow()
    await attendance_col.update_one(
        {"_id": record["_id"]},
        {"$set": {"operational_status": "OFFLINE", "updated_at": now_dt}}
    )

    # Sync presence to offline
    await sync_user_presence(
        agent_id=agent_id,
        status_str="offline",
    )

    return await get_today_attendance(agent_id)


async def set_agent_online(agent_id: str) -> dict:
    """Switch operational status from OFFLINE back to WORKING."""
    today_str = get_local_date_str()
    record = await attendance_col.find_one({"agent_id": agent_id, "date": today_str})
    if not record:
        raise ValueError("No check-in record found for today.")

    if record.get("check_out_time") or record.get("status") in ("CHECKED_OUT", "COMPLETED"):
        raise ValueError("Attendance is already checked out today.")

    now_dt = utcnow()
    await attendance_col.update_one(
        {"_id": record["_id"]},
        {"$set": {"operational_status": "WORKING", "updated_at": now_dt}}
    )

    # Sync presence to ready
    await sync_user_presence(
        agent_id=agent_id,
        status_str="ready",
        pause_reason=None,
        current_break=None,
    )

    return await get_today_attendance(agent_id)


async def check_out_agent(agent_id: str) -> dict:
    """Process check-out: close active break, calculate net working minutes & break duration."""
    today_str = get_local_date_str()
    record = await attendance_col.find_one({"agent_id": agent_id, "date": today_str})

    if not record:
        raise ValueError("No check-in record found for today.")

    if record.get("check_out_time") or record.get("status") in ("CHECKED_OUT", "COMPLETED"):
        raise ValueError("You have already checked out today.")

    active_break = await attendance_breaks_col.find_one({"agent_id": agent_id, "status": "ACTIVE"})
    now_dt = utcnow()
    now_iso = now_dt.isoformat()

    if active_break:
        start_time_str = active_break.get("start_time")
        if start_time_str:
            try:
                start_dt = datetime.fromisoformat(start_time_str.replace("Z", "+00:00"))
            except Exception:
                start_dt = now_dt
            duration_mins = max(0, int((now_dt - start_dt).total_seconds() // 60))
        else:
            duration_mins = 0

        await attendance_breaks_col.update_one(
            {"_id": active_break["_id"]},
            {
                "$set": {
                    "end_time": now_iso,
                    "duration_minutes": duration_mins,
                    "status": "COMPLETED",
                    "updated_at": now_dt,
                }
            },
        )

    att_id = str(record["_id"])
    cursor = attendance_breaks_col.find({"attendance_id": att_id, "status": "COMPLETED"})
    completed_breaks = [b async for b in cursor]
    total_break_mins = sum(b.get("duration_minutes", 0) for b in completed_breaks)

    check_in_str = record.get("check_in_time")
    if check_in_str:
        try:
            check_in_dt = datetime.fromisoformat(check_in_str.replace("Z", "+00:00"))
        except Exception:
            check_in_dt = now_dt
        gross_sec = (now_dt - check_in_dt).total_seconds()
        gross_mins = max(0, int(gross_sec // 60))
    else:
        gross_mins = 0

    net_work_mins = max(0, gross_mins - total_break_mins)
    final_status = calculate_attendance_status(net_work_mins)

    update_fields = {
        "check_out_time": now_iso,
        "total_work_minutes": net_work_mins,
        "total_break_minutes": total_break_mins,
        "status": "CHECKED_OUT",
        "derived_status": final_status,
        "operational_status": "CHECKED_OUT",
        "current_break": None,
        "updated_at": now_dt,
    }

    await attendance_col.update_one(
        {"_id": record["_id"]},
        {"$set": update_fields}
    )

    # Sync presence to offline
    await sync_user_presence(
        agent_id=agent_id,
        status_str="offline",
        logout_at=now_iso,
    )

    return await get_today_attendance(agent_id)


async def get_monthly_statistics(agent_id: str) -> dict:
    """Calculate dynamic attendance metrics for Current Month and All Time."""
    local_now = get_local_now()
    cur_year = local_now.year
    cur_month = local_now.month
    today_str = get_local_date_str(local_now)

    holidays_map = await get_holidays_map()

    num_days_in_month = calendar.monthrange(cur_year, cur_month)[1]
    month_prefix = f"{cur_year}-{cur_month:02d}"
    cursor = attendance_col.find({"agent_id": agent_id, "date": {"$regex": f"^{month_prefix}-"}})
    cur_records = {r["date"]: r async for r in cursor}

    cur_present = 0
    cur_half_day = 0
    cur_absent = 0

    for d in range(1, num_days_in_month + 1):
        d_str = f"{cur_year}-{cur_month:02d}-{d:02d}"
        if d_str > today_str or is_sunday(d_str) or d_str in holidays_map:
            continue

        rec = cur_records.get(d_str)
        if rec:
            st = rec.get("derived_status") or rec.get("status")
            mins = rec.get("total_work_minutes", 0)
            if st in ("PRESENT", "COMPLETED", "CHECKED_OUT") or mins >= FULL_DAY_MINUTES:
                cur_present += 1
            elif st == "HALF_DAY" or (mins >= HALF_DAY_MINUTES and mins < FULL_DAY_MINUTES):
                cur_half_day += 1
            else:
                cur_present += 1 if rec.get("check_in_time") else 0
        elif d_str < today_str:
            cur_absent += 1

    cur_required_days = cur_present + cur_half_day + cur_absent
    cur_rate = calculate_attendance_rate(cur_present, cur_half_day, cur_required_days)

    all_cursor = attendance_col.find({"agent_id": agent_id})
    all_records = {r["date"]: r async for r in all_cursor}

    all_present = 0
    all_half_day = 0
    all_absent = 0

    dates_list = list(all_records.keys())
    if dates_list:
        min_date_str = min(dates_list)
        try:
            start_date = datetime.strptime(min_date_str, "%Y-%m-%d").date()
        except Exception:
            start_date = d_date(cur_year, 1, 1)
    else:
        start_date = d_date(cur_year, 1, 1)

    end_date = local_now.date()
    curr_date = start_date

    while curr_date <= end_date:
        d_str = curr_date.strftime("%Y-%m-%d")
        if not is_sunday(d_str) and d_str not in holidays_map:
            rec = all_records.get(d_str)
            if rec:
                st = rec.get("derived_status") or rec.get("status")
                mins = rec.get("total_work_minutes", 0)
                if st in ("PRESENT", "COMPLETED", "CHECKED_OUT") or mins >= FULL_DAY_MINUTES:
                    all_present += 1
                elif st == "HALF_DAY" or (mins >= HALF_DAY_MINUTES and mins < FULL_DAY_MINUTES):
                    all_half_day += 1
                else:
                    all_present += 1 if rec.get("check_in_time") else 0
            elif d_str < today_str:
                all_absent += 1

        curr_date += timedelta(days=1)

    all_required_days = all_present + all_half_day + all_absent
    all_rate = calculate_attendance_rate(all_present, all_half_day, all_required_days)

    month_name = calendar.month_name[cur_month]

    return {
        "current_month": {
            "month_name": f"{month_name} (Current Month)",
            "year": cur_year,
            "month": cur_month,
            "present": cur_present,
            "half_day": cur_half_day,
            "absent": cur_absent,
            "attendance_rate": cur_rate,
        },
        "all_time": {
            "present": all_present,
            "half_day": all_half_day,
            "absent": all_absent,
            "attendance_rate": all_rate,
        },
        "attendance_rate": all_rate,
    }


async def get_monthly_calendar(agent_id: str, year: int, month: int) -> dict:
    """Generate 7-column calendar matrix for the requested month & year."""
    today_str = get_local_date_str()
    holidays_map = await get_holidays_map(year)

    month_prefix = f"{year}-{month:02d}"
    cursor = attendance_col.find({"agent_id": agent_id, "date": {"$regex": f"^{month_prefix}-"}})
    month_records = {r["date"]: r async for r in cursor}

    first_day_of_month = d_date(year, month, 1)
    num_days = calendar.monthrange(year, month)[1]

    first_weekday_python = first_day_of_month.weekday()
    first_weekday_sun_start = (first_weekday_python + 1) % 7

    calendar_days = []

    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    num_days_prev = calendar.monthrange(prev_year, prev_month)[1]

    for p in range(first_weekday_sun_start - 1, -1, -1):
        day_num = num_days_prev - p
        d_str = f"{prev_year}-{prev_month:02d}-{day_num:02d}"
        calendar_days.append({
            "date": d_str,
            "day": day_num,
            "is_current_month": False,
            "status": "MUTED",
        })

    for d in range(1, num_days + 1):
        d_str = f"{year}-{month:02d}-{d:02d}"
        rec = month_records.get(d_str)

        if is_sunday(d_str):
            day_status = "SUNDAY"
        elif d_str in holidays_map:
            day_status = "HOLIDAY"
        elif rec:
            st = rec.get("derived_status") or rec.get("status")
            mins = rec.get("total_work_minutes", 0)
            if st in ("PRESENT", "COMPLETED", "CHECKED_OUT") or mins >= FULL_DAY_MINUTES:
                day_status = "PRESENT"
            elif st == "HALF_DAY" or (mins >= HALF_DAY_MINUTES and mins < FULL_DAY_MINUTES):
                day_status = "HALF_DAY"
            else:
                day_status = "PRESENT" if rec.get("check_in_time") else "NOT_CHECKED_IN"
        elif d_str < today_str:
            day_status = "ABSENT"
        else:
            day_status = "NOT_CHECKED_IN"

        calendar_days.append({
            "date": d_str,
            "day": d,
            "is_current_month": True,
            "status": day_status,
            "holiday_name": holidays_map.get(d_str),
            "check_in_time": rec.get("check_in_time") if rec else None,
            "check_out_time": rec.get("check_out_time") if rec else None,
            "total_work_minutes": rec.get("total_work_minutes", 0) if rec else 0,
        })

    total_cells = len(calendar_days)
    remaining_cells = (7 - (total_cells % 7)) % 7
    next_month = month + 1 if month < 12 else 1
    next_year = year if month < 12 else year + 1

    for n in range(1, remaining_cells + 1):
        d_str = f"{next_year}-{next_month:02d}-{n:02d}"
        calendar_days.append({
            "date": d_str,
            "day": n,
            "is_current_month": False,
            "status": "MUTED",
        })

    month_name = calendar.month_name[month]

    return {
        "year": year,
        "month": month,
        "month_name": month_name,
        "days": calendar_days,
    }
