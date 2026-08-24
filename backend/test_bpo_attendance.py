import asyncio
from datetime import datetime, timezone
from app.routes.presence import normalize_break_key

print("Normalizing break keys:")
print("Tea Break ->", normalize_break_key("Tea Break"))
print("Lunch Break ->", normalize_break_key("Lunch Break"))
print("Personal Reason ->", normalize_break_key("Personal Reason"))
print("Test completed cleanly!")
