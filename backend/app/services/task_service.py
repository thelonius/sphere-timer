import time
from datetime import date, datetime, timezone, timedelta

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


from sqlalchemy.orm import selectinload

from sqlalchemy.orm import selectinload

async def get_tasks(db: AsyncSession, user: User) -> list[Task]:
    result = await db.execute(
        select(Task)
        .where(Task.user_id == user.id)
        .order_by(Task.order_index)
        .options(selectinload(Task.history))
        .execution_options(populate_existing=True)
    )
    tasks = result.scalars().all()
    return list(tasks)


async def create_task(db: AsyncSession, user: User, name: str, color: str) -> Task:
    # Determine next order_index
    result = await db.execute(select(func.max(Task.order_index)).where(Task.user_id == user.id))
    max_order = result.scalar() or 0
    task = Task(user_id=user.id, name=name, color=color, order_index=max_order + 1)
    db.add(task)
    await db.commit()
    # To get history properly loaded, we fetch it
    result = await db.execute(
        select(Task).where(Task.id == task.id).options(selectinload(Task.history)).execution_options(populate_existing=True)
    )
    task = result.scalar_one()
    await broadcast_event(user.id, "TASK_CREATED", _task_to_dict(task))
    return task


async def get_task_or_404(db: AsyncSession, task_id: int, user: User) -> Task:
    result = await db.execute(
        select(Task).where(Task.id == task_id).options(selectinload(Task.history)).execution_options(populate_existing=True)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
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
    updated_task = await get_task_or_404(db, task_id, user)
    await broadcast_event(user.id, "TASK_UPDATED", _task_to_dict(updated_task))
    return updated_task


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
        select(Task)
        .where(Task.user_id == user.id, Task.is_active == True)
        .options(selectinload(Task.history))
        .execution_options(populate_existing=True)
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

    await _stop_active_tasks(db, redis, user)

    now_ms = _now_ms()
    task.is_active = True
    task.start_time = now_ms
    await redis.set(f"timer:{task_id}", str(now_ms))

    await db.commit()
    db.expunge_all()
    task = await get_task_or_404(db, task_id, user)
    await broadcast_event(user.id, "TASK_STARTED", _task_to_dict(task))
    return task


async def stop_timer(db: AsyncSession, redis: aioredis.Redis, task_id: int, user: User) -> tuple[Task, int]:
    task = await get_task_or_404(db, task_id, user)
    if not task.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Timer is not running")

    elapsed = await _do_stop(db, redis, task)
    await db.commit()
    db.expunge_all()
    task = await get_task_or_404(db, task_id, user)
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

    total_time: int = 0
    total_sessions: int = 0
    for h in all_history:
        total_time += h.time
        total_sessions += h.sessions

    # Group daily
    daily: dict[date, dict] = {}
    for h in all_history:
        h_date = h.date
        if h_date not in daily:
            daily[h_date] = {"date": h_date, "time": 0, "sessions": 0}
        daily[h_date]["time"] += h.time
        daily[h_date]["sessions"] += h.sessions

    # Include active session portions for all days it covers
    for t in tasks:
        if t.is_active and t.start_time:
            n_ms = _now_ms()
            total_time = total_time + (n_ms - t.start_time)
            total_sessions = total_sessions + 1

            # Distribute time across days
            s_start_dt = datetime.fromtimestamp(t.start_time / 1000).date()
            t_dt = date.today()
            
            c_d = s_start_dt
            while c_d <= t_dt:
                # Check if this day is within requested range
                in_range = True
                if start_date is not None and c_d < start_date:
                    in_range = False
                if end_date is not None and c_d > end_date:
                    in_range = False
                
                if in_range:
                    d_start_ms = int(datetime.combine(c_d, datetime.min.time()).replace(tzinfo=None).timestamp() * 1000)
                    d_end_ms = d_start_ms + 86400000 # 24 * 60 * 60 * 1000
                    
                    ov_start = max(t.start_time, d_start_ms)
                    ov_end = min(n_ms, d_end_ms)
                    
                    if ov_end > ov_start:
                        if c_d not in daily:
                            daily[c_d] = {"date": c_d, "time": 0, "sessions": 0}
                        daily[c_d]["time"] += (ov_end - ov_start)
                        if c_d == t_dt:
                            daily[c_d]["sessions"] += 1
                
                c_d = c_d + timedelta(days=1)

    return {
        "total_time": total_time,
        "total_sessions": total_sessions,
        "tasks_count": len(tasks),
        "active_tasks": int(sum(1 for task in tasks if task.is_active)),
        "daily_stats": sorted(
            [{"date": str(v["date"]), "time": v["time"], "sessions": v["sessions"]} for v in daily.values()],
            key=lambda x: str(x["date"])
        ),
    }
