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
        "isArchived": t.is_archived,
        "startTime": t.start_time,
        "orderIndex": t.order_index,
        "history": [{"id": h.id, "date": str(h.date), "time": h.time, "sessions": h.sessions} for h in (t.history or [])],
    }


from sqlalchemy.orm import selectinload


def _day_start_ms(d: date) -> int:
    return int(datetime.combine(d, datetime.min.time()).timestamp() * 1000)


async def _check_name_unique(db: AsyncSession, user: User, name: str, exclude_id: int | None = None) -> None:
    q = select(Task).where(Task.user_id == user.id, func.lower(Task.name) == name.lower().strip())
    if exclude_id is not None:
        q = q.where(Task.id != exclude_id)
    if (await db.execute(q)).scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Task with this name already exists")


async def get_tasks(db: AsyncSession, user: User, include_archived: bool = False) -> list[Task]:
    q = select(Task).where(Task.user_id == user.id)
    if not include_archived:
        q = q.where(~Task.is_archived)
    q = q.order_by(Task.order_index).options(selectinload(Task.history)).execution_options(populate_existing=True)
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_task(db: AsyncSession, user: User, name: str, color: str) -> Task:
    await _check_name_unique(db, user, name)

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
        await _check_name_unique(db, user, name, exclude_id=task_id)
        task.name = name
    if color is not None:
        task.color = color
    if order_index is not None:
        task.order_index = order_index
    await db.commit()
    updated_task = await get_task_or_404(db, task_id, user)
    await broadcast_event(user.id, "TASK_UPDATED", _task_to_dict(updated_task))
    return updated_task


async def set_archived(db: AsyncSession, redis: aioredis.Redis | None, task_id: int, user: User, archived: bool) -> Task:
    task = await get_task_or_404(db, task_id, user)
    if archived and task.is_active:
        await _do_stop(db, redis, task)
    task.is_archived = archived
    await db.commit()
    task = await get_task_or_404(db, task_id, user)
    event = "TASK_ARCHIVED" if archived else "TASK_RESTORED"
    await broadcast_event(user.id, event, _task_to_dict(task))
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
    now_ms = _now_ms()
    elapsed = max(0, now_ms - start_ms)

    task.total_time += elapsed
    task.is_active = False
    task.start_time = None

    # Split session across calendar days it spans
    start_dt = datetime.fromtimestamp(start_ms / 1000).date()
    end_dt = date.today()
    current_date = start_dt
    while current_date <= end_dt:
        d_start_ms = _day_start_ms(current_date)
        d_end_ms = d_start_ms + 86400000

        ov_start = max(start_ms, d_start_ms)
        ov_end = min(now_ms, d_end_ms)

        if ov_end > ov_start:
            day_ms = ov_end - ov_start
            result = await db.execute(
                select(TaskHistory).where(TaskHistory.task_id == task.id, TaskHistory.date == current_date)
            )
            history_entry = result.scalar_one_or_none()
            if history_entry:
                history_entry.time += day_ms
                if current_date == end_dt:
                    history_entry.sessions += 1
            else:
                history_entry = TaskHistory(
                    task_id=task.id,
                    date=current_date,
                    time=day_ms,
                    sessions=1 if current_date == end_dt else 0,
                )
                db.add(history_entry)

        current_date += timedelta(days=1)

    await redis.delete(f"timer:{task.id}")
    return elapsed


async def start_timer(db: AsyncSession, redis: aioredis.Redis, task_id: int, user: User) -> Task:
    task = await get_task_or_404(db, task_id, user)

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

            current_date = s_start_dt
            while current_date <= t_dt:
                in_range = (
                    (start_date is None or current_date >= start_date) and
                    (end_date is None or current_date <= end_date)
                )
                if in_range:
                    d_start_ms = _day_start_ms(current_date)
                    d_end_ms = d_start_ms + 86400000
                    ov_start = max(t.start_time, d_start_ms)
                    ov_end = min(n_ms, d_end_ms)
                    if ov_end > ov_start:
                        if current_date not in daily:
                            daily[current_date] = {"date": current_date, "time": 0, "sessions": 0}
                        daily[current_date]["time"] += ov_end - ov_start
                        if current_date == t_dt:
                            daily[current_date]["sessions"] += 1
                current_date += timedelta(days=1)

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
