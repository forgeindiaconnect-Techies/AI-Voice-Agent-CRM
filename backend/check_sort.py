import asyncio
from app.core.database import leads_col

async def main():
    try:
        leads = await leads_col.find({}).sort("created_at", -1).to_list(500)
        print("Sorted leads count:", len(leads))
    except Exception as e:
        print("Error sorting:", e)

if __name__ == "__main__":
    asyncio.run(main())
