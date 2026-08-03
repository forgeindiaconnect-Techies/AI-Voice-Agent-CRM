import asyncio
from app.core.database import leads_col

async def main():
    count = await leads_col.count_documents({})
    print(f"TOTAL LEADS IN MONGODB: {count}")
    docs = await leads_col.find({}).to_list(10)
    for d in docs:
        print(d)

if __name__ == "__main__":
    asyncio.run(main())
