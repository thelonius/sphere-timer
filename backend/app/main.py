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
    # Accept first so the client always gets a clean close frame instead of ECONNRESET
    await websocket.accept()
    user_id = None
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])

        await manager.connect_already_accepted(user_id, websocket)

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WS Error for user {user_id}: {e}")
        try:
            # 4001 = auth error; frontend uses this to trigger token refresh
            await websocket.close(code=4001)
        except Exception:
            pass
        return
    finally:
        if user_id is not None:
            manager.disconnect(user_id, websocket)
        try:
            await websocket.close()
        except Exception:
            pass
