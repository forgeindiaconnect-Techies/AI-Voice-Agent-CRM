from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from bson import ObjectId
from app.services.ws_manager import ws_manager
from app.core.security import decode_token
from app.core.database import users_col

router = APIRouter()


@router.websocket("/ws/pool/{pool_id}")
async def pool_ws(websocket: WebSocket, pool_id: str, token: str | None = None):
    # Authenticate WebSocket if token is provided or verify access token
    if token:
        try:
            payload = decode_token(token)
            if not payload or payload.get("type") != "access":
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
            user = await users_col.find_one({"_id": ObjectId(payload["sub"])})
            if not user or not user.get("is_active", True):
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return
        except Exception:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    await ws_manager.connect(pool_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping from client
    except WebSocketDisconnect:
        ws_manager.disconnect(pool_id, websocket)

