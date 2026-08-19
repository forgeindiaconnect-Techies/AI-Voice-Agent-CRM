import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import leads_col, calls_col, imports_col

async def clear_all_leads():
    res1 = await leads_col.delete_many({})
    res2 = await calls_col.delete_many({})
    res3 = await imports_col.delete_many({})
    print(f"[CLEANUP SUCCESS] Deleted {res1.deleted_count} lead records from MongoDB database.")
    print(f"[CLEANUP SUCCESS] Deleted {res2.deleted_count} call log records from MongoDB database.")
    print(f"[CLEANUP SUCCESS] Deleted {res3.deleted_count} import batch records from MongoDB database.")

if __name__ == "__main__":
    asyncio.run(clear_all_leads())
