from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.redis_client import get_redis_client, close_redis
from app.routers import auth, tasks, user
from app.dependencies import decode_token
from app.services.ws_manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: warm up Redis connection
    await get_redis_client()
    yield
    # Shutdown: close Redis
    await close_redis()


app = FastAPI(
    title="SphereTimer API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(user.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
):
    user_id = None
    try:
        # Authenticate
        payload = decode_token(token)
        user_id = int(payload["sub"])
        
        await manager.connect(user_id, websocket)
        
        # Keep connection open until disconnect
        while True:
            # We don't expect messages from client yet, 
            # but we need this to detect disconnection
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass  # Handled in finally
    except Exception as e:
        print(f"WS Error for user {user_id}: {e}")
    finally:
        if user_id is not None:
            manager.disconnect(user_id, websocket)
        try:
            await websocket.close()
        except:
            pass
