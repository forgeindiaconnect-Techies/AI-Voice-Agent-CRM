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
        """Send to all WebSocket clients in a specific pool."""
        dead = []
        for ws in self.pool_connections.get(pool_id, []):
            try:
                await ws.send_text(json.dumps(message, default=str))
            except Exception:
                dead.append(ws)
        for d in dead:
            self.disconnect(pool_id, d)

    async def broadcast_global(self, message: dict):
        """Broadcast to ALL connected WebSocket clients across every pool.
        
        Used for events like Twilio status-callbacks that need to reach
        the active agent's softphone regardless of which pool they're in.
        """
        payload = json.dumps(message, default=str)
        dead: list[tuple[str, WebSocket]] = []
        for pool_id, connections in list(self.pool_connections.items()):
            for ws in connections:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append((pool_id, ws))
        for pool_id, ws in dead:
            self.disconnect(pool_id, ws)


ws_manager = WSManager()
