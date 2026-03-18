import time
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis

from app.models.task import Task
from app.models.task_history import TaskHistory
from app.models.user import User
from app.services.ws_manager import broadcast_event


def _now_ms() -> int:
    return int(time.time() * 1000)


def _task_to_dict(t: Task) -> dict:
    """Helper to serialize task for WebSocket broadcast."""
    return {
        "id": t.id,
        "name": t.name,
        "color": t.color,
        "totalTime": t.total_time,
        "isActive": t.is_active,
        "startTime": t.start_time,
        "orderIndex": t.order_index,
        "history": [{"id": h.id, "date": str(h.date), "time": h.time, "sessions": h.sessions} for h in (t.history or [])],
    }


async def get_tasks(db: AsyncSession, user: User) -> list[Task]:
    result = await db.execute(
        select(Task).where(Task.user_id == user.id).order_by(Task.order_index)
    )
    tasks = result.scalars().all()
    # Eagerly load history for each task
    for task in tasks:
        await db.refresh(task, ["history"])
    return list(tasks)


async def create_task(db: AsyncSession, user: User, name: str, color: str) -> Task:
    # Determine next order_index
    result = await db.execute(select(func.max(Task.order_index)).where(Task.user_id == user.id))
    max_order = result.scalar() or 0
    task = Task(user_id=user.id, name=name, color=color, order_index=max_order + 1)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    await db.refresh(task, ["history"])
    await broadcast_event(user.id, "TASK_CREATED", _task_to_dict(task))
    return task


async def get_task_or_404(db: AsyncSession, task_id: int, user: User) -> Task:
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    await db.refresh(task, ["history"])
    return task


async def update_task(
    db: AsyncSession, task_id: int, user: User, name: str | None, color: str | None, order_index: int | None
) -> Task:
    task = await get_task_or_404(db, task_id, user)
    if name is not None:
        task.name = name
    if color is not None:
        task.color = color
    if order_index is not None:
        task.order_index = order_index
    await db.commit()
    await db.refresh(task)
    await db.refresh(task, ["history"])
    await broadcast_event(user.id, "TASK_UPDATED", _task_to_dict(task))
    return task


async def delete_task(db: AsyncSession, redis: aioredis.Redis, task_id: int, user: User) -> None:
    task = await get_task_or_404(db, task_id, user)
    await redis.delete(f"timer:{task_id}")
    await db.delete(task)
    await db.commit()
    await broadcast_event(user.id, "TASK_DELETED", {"id": task_id})


# ─── Timer ─────────────────────────────────────────────────────────────────────

async def _stop_active_tasks(db: AsyncSession, redis: aioredis.Redis, user: User) -> None:
    """Stop any currently running task for this user."""
    result = await db.execute(
        select(Task).where(Task.user_id == user.id, Task.is_active == True)  # noqa: E712
    )
    active_tasks = result.scalars().all()
    for t in active_tasks:
        await _do_stop(db, redis, t)


async def _do_stop(db: AsyncSession, redis: aioredis.Redis, task: Task) -> int:
    """Core stop logic — returns elapsed ms."""
    start_ms_str = await redis.get(f"timer:{task.id}")
    start_ms = int(start_ms_str) if start_ms_str else (task.start_time or _now_ms())
    elapsed = max(0, _now_ms() - start_ms)

    task.total_time += elapsed
    task.is_active = False
    task.start_time = None

    # Upsert today's history
    today = date.today()
    result = await db.execute(
        select(TaskHistory).where(TaskHistory.task_id == task.id, TaskHistory.date == today)
    )
    history_entry = result.scalar_one_or_none()
    if history_entry:
        history_entry.time += elapsed
        history_entry.sessions += 1
    else:
        history_entry = TaskHistory(task_id=task.id, date=today, time=elapsed, sessions=1)
        db.add(history_entry)

    await redis.delete(f"timer:{task.id}")
    return elapsed


async def start_timer(db: AsyncSession, redis: aioredis.Redis, task_id: int, user: User) -> Task:
    task = await get_task_or_404(db, task_id, user)

    # Auto-stop any other active task
    await _stop_active_tasks(db, redis, user)

    now_ms = _now_ms()
    task.is_active = True
    task.start_time = now_ms
    await redis.set(f"timer:{task_id}", str(now_ms))

    await db.commit()
    await db.refresh(task)
    await broadcast_event(user.id, "TASK_STARTED", _task_to_dict(task))
    # Note: _stop_active_tasks already broadcasts its own "TASK_STOPPED" if we wanted,
    # but for simplicity let's rely on the client refreshing or the START event stopping others.
    return task


async def stop_timer(db: AsyncSession, redis: aioredis.Redis, task_id: int, user: User) -> tuple[Task, int]:
    task = await get_task_or_404(db, task_id, user)
    if not task.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Timer is not running")

    elapsed = await _do_stop(db, redis, task)
    await db.commit()
    await db.refresh(task)
    await db.refresh(task, ["history"])
    await broadcast_event(user.id, "TASK_STOPPED", _task_to_dict(task))
    return task, elapsed


# ─── Stats ─────────────────────────────────────────────────────────────────────

async def get_stats(
    db: AsyncSession, user: User, task_id: int | None, start_date: date | None, end_date: date | None
) -> dict:
    task_query = select(Task).where(Task.user_id == user.id)
    if task_id:
        task_query = task_query.where(Task.id == task_id)
    tasks_result = await db.execute(task_query)
    tasks = tasks_result.scalars().all()
    task_ids = [t.id for t in tasks]

    history_query = select(TaskHistory).where(TaskHistory.task_id.in_(task_ids))
    if start_date:
        history_query = history_query.where(TaskHistory.date >= start_date)
    if end_date:
        history_query = history_query.where(TaskHistory.date <= end_date)
    history_result = await db.execute(history_query)
    all_history = history_result.scalars().all()

    total_time = sum(h.time for h in all_history)
    total_sessions = sum(h.sessions for h in all_history)

    # Group daily
    daily: dict[date, dict] = {}
    for h in all_history:
        if h.date not in daily:
            daily[h.date] = {"date": h.date, "time": 0, "sessions": 0}
        daily[h.date]["time"] += h.time
        daily[h.date]["sessions"] += h.sessions

    return {
        "total_time": total_time,
        "total_sessions": total_sessions,
        "tasks_count": len(tasks),
        "active_tasks": sum(1 for t in tasks if t.is_active),
        "daily_stats": sorted(daily.values(), key=lambda x: x["date"]),
    }
