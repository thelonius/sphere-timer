from datetime import date, datetime
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True
    )


class HistoryEntry(CamelModel):
    id: int
    date: date
    time: int        # milliseconds
    sessions: int


class TaskOut(CamelModel):
    id: int
    name: str
    color: str
    total_time: int
    is_active: bool
    start_time: int | None
    order_index: int
    history: list[HistoryEntry] = []
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TaskCreate(CamelModel):
    name: str
    color: str


class TaskUpdate(CamelModel):
    name: str | None = None
    color: str | None = None
    order_index: int | None = None


class TimerStartOut(CamelModel):
    id: int
    is_active: bool
    start_time: int


class TimerStopOut(CamelModel):
    id: int
    is_active: bool
    start_time: None
    total_time: int
    time_added: int
    history: list[HistoryEntry]


class DailyStat(CamelModel):
    date: date
    time: int
    sessions: int


class StatsOut(CamelModel):
    total_time: int
    total_sessions: int
    tasks_count: int
    active_tasks: int
    daily_stats: list[DailyStat]
