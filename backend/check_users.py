import asyncio
from app.core.database import users_col

async def main():
    users = await users_col.find({}).to_list(20)
    for u in users:
        print(u)

if __name__ == "__main__":
    asyncio.run(main())
