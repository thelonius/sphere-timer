from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.models.user import User
from app.services.auth_service import hash_password, verify_password


async def get_profile(db: AsyncSession, user: User) -> dict:
    tasks_result = await db.execute(select(Task).where(Task.user_id == user.id))
    tasks = tasks_result.scalars().all()
    total_time = sum(t.total_time for t in tasks)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "tasks_count": len(tasks),
        "total_time_tracked": total_time,
    }


async def update_profile(
    db: AsyncSession, user: User, username: str | None, email: str | None
) -> User:
    if username and username != user.username:
        existing = await db.execute(select(User).where(User.username == username))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
        user.username = username

    if email and email != user.email:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
        user.email = email

    await db.commit()
    await db.refresh(user)
    return user


async def change_password(db: AsyncSession, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 6 characters")
    user.password_hash = hash_password(new_password)
    await db.commit()
