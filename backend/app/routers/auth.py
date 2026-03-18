from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_redis, get_current_user, rate_limit
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest, UserOut, TokenData
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()
auth_limiter = rate_limit(max_requests=50, window_seconds=900)


def _user_out(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/register")
async def register(
    body: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    _: Annotated[None, Depends(auth_limiter)],
):
    user, access, refresh = await auth_service.register_user(db, redis, body.username, body.email, body.password)
    return {
        "success": True,
        "data": {"user": _user_out(user), "token": access, "refreshToken": refresh},
        "message": "Registration successful",
    }


@router.post("/login")
async def login(
    body: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    _: Annotated[None, Depends(auth_limiter)],
):
    user, access, refresh = await auth_service.login_user(db, redis, body.email, body.password)
    return {
        "success": True,
        "data": {"user": _user_out(user), "token": access, "refreshToken": refresh},
        "message": "Login successful",
    }


@router.post("/logout")
async def logout(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    _current: Annotated[User, Depends(get_current_user)],
):
    await auth_service.logout_user(redis, credentials.credentials)
    return {"success": True, "message": "Logout successful"}


@router.get("/verify")
async def verify(current_user: Annotated[User, Depends(get_current_user)]):
    return {
        "success": True,
        "data": {"user": _user_out(current_user)},
    }


@router.post("/refresh")
async def refresh(
    body: RefreshRequest,
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
):
    new_access, new_refresh = await auth_service.refresh_tokens(redis, body.refresh_token)
    return {
        "success": True,
        "data": {"token": new_access, "refreshToken": new_refresh},
        "message": "Token refreshed",
    }
