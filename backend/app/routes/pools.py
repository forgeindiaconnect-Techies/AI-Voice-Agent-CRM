from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from app.core.database import pools_col, audit_logs_col
from app.core.utils import utcnow, oid_str
from app.core.deps import require_roles, get_current_user
from app.schemas.common import PoolCreate, Role
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/api/pools", tags=["pools"])


@router.post("", dependencies=[Depends(require_roles(Role.ADMIN))])
async def create_pool(payload: PoolCreate, user: dict = Depends(get_current_user)):
    # Restrict to permitted names
    if payload.name not in ["recruitment", "credit_card_sales", "customer_support"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pool name. Permitted pools: recruitment, credit_card_sales, customer_support"
        )

    # Check active pools count
    active_count = await pools_col.count_documents({"is_deleted": {"$ne": True}})
    if active_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum pool limit reached (3 pools max)"
        )

    # Check for duplicates
    existing = await pools_col.find_one({"name": payload.name, "is_deleted": {"$ne": True}})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An active pool with this name already exists"
        )

    # Create or restore pool
    existing_soft_deleted = await pools_col.find_one({"name": payload.name, "is_deleted": True})
    if existing_soft_deleted:
        await pools_col.update_one(
            {"_id": existing_soft_deleted["_id"]},
            {"$set": {"is_deleted": False, "updated_at": utcnow()}}
        )
        doc = existing_soft_deleted
        doc["is_deleted"] = False
    else:
        doc = payload.model_dump()
        doc["created_at"] = utcnow()
        doc["is_deleted"] = False
        result = await pools_col.insert_one(doc)
        doc["_id"] = result.inserted_id

    # Create audit log
    await audit_logs_col.insert_one({
        "action": "create_pool",
        "user_id": user.get("id") or str(user["_id"]),
        "pool_name": payload.name,
        "timestamp": utcnow()
    })

    # Broadcast to update dashboard
    await ws_manager.broadcast("global", {"event": "pools_updated"})

    return oid_str(doc)


@router.get("")
async def list_pools(user: dict = Depends(get_current_user)):
    pools = []
    async for p in pools_col.find({"is_deleted": {"$ne": True}}):
        pools.append(oid_str(p))
    return pools


@router.delete("/{pool_id}", dependencies=[Depends(require_roles(Role.ADMIN))])
async def delete_pool(pool_id: str, user: dict = Depends(get_current_user)):
    pool = await pools_col.find_one({"_id": ObjectId(pool_id)})
    if not pool:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pool not found")

    await pools_col.update_one({"_id": ObjectId(pool_id)}, {"$set": {"is_deleted": True, "deleted_at": utcnow()}})

    # Create audit log
    await audit_logs_col.insert_one({
        "action": "delete_pool",
        "user_id": user.get("id") or str(user["_id"]),
        "pool_id": pool_id,
        "pool_name": pool.get("name"),
        "timestamp": utcnow()
    })

    # Broadcast to update dashboard
    await ws_manager.broadcast("global", {"event": "pools_updated"})

    return {"status": "deleted", "pool_id": pool_id}
