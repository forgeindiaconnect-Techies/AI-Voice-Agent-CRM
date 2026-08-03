import asyncio
from app.core.database import pools_col

async def main():
    pools = await pools_col.find({}).to_list(20)
    for p in pools:
        print(p)

if __name__ == "__main__":
    asyncio.run(main())
