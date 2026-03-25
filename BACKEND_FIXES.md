# Backend Fixes Required for SphereTimer

To maintain system stability and prevent memory leaks, apply the following changes to the backend codebase.

## 1. Fix WebSocket Leaks in `main.py`

**File:** `backend/app/main.py`

The current implementation only disconnects from the manager on a clean `WebSocketDisconnect`. Any other exception (like a network drop or parsing error) will leave the connection registered in memory.

**Change:**
```python
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    user_id = None
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
        await manager.connect(user_id, websocket)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass # Disconnect will be handled in 'finally'
    except Exception as e:
        print(f"WS Error: {e}")
    finally:
        if user_id is not None:
            manager.disconnect(user_id, websocket)
        try:
            await websocket.close()
        except:
            pass
```

## 2. Fix Concurrency and Leaks in `ws_manager.py`

**File:** `backend/app/services/ws_manager.py`

1. **Concurrency:** Iterating over `self.active_connections[user_id]` directly can cause a `RuntimeError` if a connection is dropped during iteration.
2. **Resource Cleanup:** The `pubsub` object should be properly closed to avoid leaking Redis resources.

**Change:**
```python
async def _redis_listener(self, user_id: int):
    redis = await get_redis_client()
    pubsub = redis.pubsub()
    channel = f"user_sync:{user_id}"
    await pubsub.subscribe(channel)
    
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                # Use a copy of the connection set for safe iteration
                connections = list(self.active_connections.get(user_id, set()))
                for ws in connections:
                    try:
                        await ws.send_text(data)
                    except Exception:
                        self.disconnect(user_id, ws)
    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close() # CRITICAL: Close the pubsub subscriber
```

## 3. Security Hardening

**File:** `.env` and `backend/app/config.py`

Ensure `JWT_SECRET` is set to a long random string in production and that `ALLOWED_ORIGINS` accurately reflects the production URLs.
