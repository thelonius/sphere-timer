from typing import Dict, List, Set
from fastapi import WebSocket
import json
import asyncio
import redis.asyncio as aioredis
from app.redis_client import get_redis_client

class ConnectionManager:
    def __init__(self):
        # user_id -> set of active WebSockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # user_id -> background task for Redis subscription
        self.pubsub_tasks: Dict[int, asyncio.Task] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
            # Start a Redis listener for this user if not already running
            task = asyncio.create_task(self._redis_listener(user_id))
            self.pubsub_tasks[user_id] = task
        
        self.active_connections[user_id].add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                # Stop Redis listener for this user
                if user_id in self.pubsub_tasks:
                    self.pubsub_tasks[user_id].cancel()
                    del self.pubsub_tasks[user_id]

    async def _redis_listener(self, user_id: int):
        redis = await get_redis_client()
        pubsub = redis.pubsub()
        channel = f"user_sync:{user_id}"
        await pubsub.subscribe(channel)
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    
                    # Broadcast to all this user's connections
                    if user_id in self.active_connections:
                        dead_links = []
                        for ws in self.active_connections[user_id]:
                            try:
                                await ws.send_text(data)
                            except Exception:
                                dead_links.append(ws)
                        
                        # Cleanup dead links
                        for ws in dead_links:
                            self.disconnect(user_id, ws)
        except asyncio.CancelledError:
            await pubsub.unsubscribe(channel)
        except Exception as e:
            print(f"Error in Redis listener for user {user_id}: {e}")

manager = ConnectionManager()

async def broadcast_event(user_id: int, event_type: str, data: dict):
    redis = await get_redis_client()
    payload = {
        "type": event_type,
        "data": data
    }
    await redis.publish(f"user_sync:{user_id}", json.dumps(payload))
