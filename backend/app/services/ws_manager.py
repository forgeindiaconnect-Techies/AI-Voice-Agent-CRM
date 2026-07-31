from fastapi import WebSocket
from collections import defaultdict
import json


class WSManager:
    def __init__(self):
        self.pool_connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, pool_id: str, ws: WebSocket):
        await ws.accept()
        self.pool_connections[pool_id].append(ws)

    def disconnect(self, pool_id: str, ws: WebSocket):
        if ws in self.pool_connections.get(pool_id, []):
            self.pool_connections[pool_id].remove(ws)

    async def broadcast(self, pool_id: str, message: dict):
        dead = []
        for ws in self.pool_connections.get(pool_id, []):
            try:
                await ws.send_text(json.dumps(message, default=str))
            except Exception:
                dead.append(ws)
        for d in dead:
            self.disconnect(pool_id, d)


ws_manager = WSManager()
