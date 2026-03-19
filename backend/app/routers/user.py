from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.user import UpdateProfileRequest, ChangePasswordRequest
from app.services import user_service

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/profile")
async def get_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    profile = await user_service.get_profile(db, current_user)
    return {"success": True, "data": profile}


@router.put("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    user = await user_service.update_profile(db, current_user, body.username, body.email)
    return {
        "success": True,
        "data": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        },
        "message": "Profile updated",
    }


@router.put("/password")
async def change_password(
    body: ChangePasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    await user_service.change_password(db, current_user, body.current_password, body.new_password)
    return {"success": True, "message": "Password changed"}
