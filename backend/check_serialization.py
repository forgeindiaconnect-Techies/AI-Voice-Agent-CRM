import asyncio
import json
from bson import ObjectId
from datetime import datetime
from app.core.database import leads_col

def custom_encoder(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")

async def main():
    leads = await leads_col.find({}).to_list(100)
    for l in leads:
        if "_id" in l:
            l["id"] = str(l["_id"])
            del l["_id"]
            
        try:
            # Let's see if the STANDARD json.dumps works on it WITHOUT the custom encoder
            # If it fails, that means FastAPI will likely fail too, since FastAPI's jsonable_encoder handles ObjectId but wait, DOES IT?
            # Actually FastAPI's jsonable_encoder DOES NOT handle ObjectId automatically unless you define a custom json_encoder in a Pydantic model!
            pass
        except Exception as e:
            pass

        # Check for ObjectId values manually!
        for k, v in l.items():
            if isinstance(v, ObjectId):
                print(f"FOUND ObjectId in field '{k}' of lead {l.get('id')}: {v}")

if __name__ == "__main__":
    asyncio.run(main())
