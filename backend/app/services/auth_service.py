from datetime import datetime, timezone

from fastapi import HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis
from jose import jwt, JWTError

from app.config import settings
from app.dependencies import create_access_token, create_refresh_token
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


async def register_user(db: AsyncSession, redis: aioredis.Redis, username: str, email: str, password: str) -> tuple[User, str, str]:
    # Check uniqueness
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    existing_u = await db.execute(select(User).where(User.username == username))
    if existing_u.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")

    if len(password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")

    user = User(username=username, email=email, password_hash=hash_password(password))
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)

    # Store refresh token in Redis
    ttl = settings.refresh_token_expire_days * 86400
    await redis.set(f"refresh:{user.id}:{refresh}", "1", ex=ttl)

    return user, access, refresh


async def login_user(db: AsyncSession, redis: aioredis.Redis, email: str, password: str) -> tuple[User, str, str]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    access = create_access_token(user.id)
    refresh = create_refresh_token(user.id)

    # Store refresh token in Redis
    ttl = settings.refresh_token_expire_days * 86400
    await redis.set(f"refresh:{user.id}:{refresh}", "1", ex=ttl)

    return user, access, refresh


async def logout_user(redis: aioredis.Redis, access_token: str) -> None:
    """Blacklist the access token until it naturally expires."""
    try:
        payload = jwt.decode(access_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        exp = payload.get("exp")
        if exp:
            ttl = max(0, int(exp - datetime.now(timezone.utc).timestamp()))
            await redis.set(f"blacklist:{access_token}", "1", ex=ttl)
    except JWTError:
        pass  # already invalid — nothing to do


async def refresh_tokens(redis: aioredis.Redis, refresh_token: str) -> tuple[str, str]:
    try:
        payload = jwt.decode(refresh_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not a refresh token")

    user_id = int(payload["sub"])
    stored = await redis.get(f"refresh:{user_id}:{refresh_token}")
    if not stored:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked or expired")

    # Rotate: delete old, issue new
    await redis.delete(f"refresh:{user_id}:{refresh_token}")
    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    ttl = settings.refresh_token_expire_days * 86400
    await redis.set(f"refresh:{user_id}:{new_refresh}", "1", ex=ttl)

    return new_access, new_refresh
