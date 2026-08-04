import asyncio
from app.core.database import users_col

async def main():
    priya = await users_col.find_one({"email": "tl@forgeindia.com"})
    print("PRIYA ROLE:", priya["role"])

if __name__ == "__main__":
    asyncio.run(main())
