from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, get_redis, get_current_user
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut, TimerStartOut, TimerStopOut, StatsOut
from app.services import task_service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=None)
async def list_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    tasks = await task_service.get_tasks(db, current_user)
    return {"success": True, "data": [_task_out(t) for t in tasks]}


@router.post("", status_code=201)
async def create_task(
    body: TaskCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    task = await task_service.create_task(db, current_user, body.name, body.color)
    return {"success": True, "data": _task_out(task), "message": "Task created"}


@router.put("/{task_id}")
async def update_task(
    task_id: int,
    body: TaskUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    task = await task_service.update_task(db, task_id, current_user, body.name, body.color, body.order_index)
    return {"success": True, "data": _task_out(task), "message": "Task updated"}


@router.delete("/{task_id}")
async def delete_task(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    await task_service.delete_task(db, redis, task_id, current_user)
    return {"success": True, "message": "Task deleted"}


@router.post("/{task_id}/start")
async def start_timer(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    task = await task_service.start_timer(db, redis, task_id, current_user)
    return {
        "success": True,
        "data": {"id": task.id, "isActive": task.is_active, "startTime": task.start_time},
        "message": "Timer started",
    }


@router.post("/{task_id}/stop")
async def stop_timer(
    task_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[aioredis.Redis, Depends(get_redis)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    task, elapsed = await task_service.stop_timer(db, redis, task_id, current_user)
    return {
        "success": True,
        "data": {
            "id": task.id,
            "isActive": False,
            "startTime": None,
            "totalTime": task.total_time,
            "timeAdded": elapsed,
            "history": [_history_out(h) for h in task.history],
        },
        "message": "Timer stopped",
    }


@router.get("/stats")
async def get_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    task_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
):
    stats = await task_service.get_stats(db, current_user, task_id, start_date, end_date)
    return {"success": True, "data": stats}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _history_out(h) -> dict:
    return {"id": h.id, "date": str(h.date), "time": h.time, "sessions": h.sessions}


def _task_out(t) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "color": t.color,
        "totalTime": t.total_time,
        "isActive": t.is_active,
        "startTime": t.start_time,
        "orderIndex": t.order_index,
        "history": [_history_out(h) for h in (t.history or [])],
        "createdAt": t.created_at.isoformat() if t.created_at else None,
        "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
    }
