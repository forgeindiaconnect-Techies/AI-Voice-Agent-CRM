from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.ws_manager import ws_manager

router = APIRouter()


@router.websocket("/ws/pool/{pool_id}")
async def pool_ws(websocket: WebSocket, pool_id: str):
    await ws_manager.connect(pool_id, websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping from client
    except WebSocketDisconnect:
        ws_manager.disconnect(pool_id, websocket)
