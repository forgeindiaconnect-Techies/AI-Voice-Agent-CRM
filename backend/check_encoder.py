import asyncio
from fastapi.encoders import jsonable_encoder
from app.core.database import leads_col

async def main():
    leads = await leads_col.find({}).to_list(100)
    for l in leads:
        if "_id" in l:
            l["id"] = str(l["_id"])
            del l["_id"]
            
    try:
        encoded = jsonable_encoder(leads)
        print("Successfully encoded leads!")
    except Exception as e:
        print("Failed to encode leads:", e)

if __name__ == "__main__":
    asyncio.run(main())
