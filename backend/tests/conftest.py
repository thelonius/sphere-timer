"""
Test fixtures using:
- aiosqlite (in-memory SQLite) as database
- fakeredis as Redis replacement
No external services required.
"""
import os

# Override env before any app imports
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "15")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "7")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")

import pytest
import pytest_asyncio
import fakeredis.aioredis
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.database import Base
from app.main import app
from app.dependencies import get_db, get_redis

# ─── In-memory SQLite engine (shared across all tests in a session) ──────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def fake_redis():
    r = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield r
    await r.aclose()


@pytest_asyncio.fixture
async def client(db_session, fake_redis):
    """Async test client with overridden DB and Redis."""
    async def override_db():
        yield db_session

    async def override_redis():
        return fake_redis

    # Override FastAPI dependencies
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_redis] = override_redis

    # ALSO mock the global get_redis_client where it's used
    # because some services (like ws_manager.broadcast_event) call it directly.
    import app.services.ws_manager as ws_manager
    from unittest.mock import AsyncMock
    
    original_ws_get_redis = ws_manager.get_redis_client
    ws_manager.get_redis_client = AsyncMock(return_value=fake_redis)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    # Cleanup
    app.dependency_overrides.clear()
    ws_manager.get_redis_client = original_ws_get_redis
