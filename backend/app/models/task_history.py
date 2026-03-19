from datetime import date, datetime
from sqlalchemy import BigInteger, Integer, ForeignKey, Date, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class TaskHistory(Base):
    __tablename__ = "task_history"
    __table_args__ = (UniqueConstraint("task_id", "date", name="uq_task_history_task_date"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    time: Mapped[int] = mapped_column(BigInteger, nullable=False)         # milliseconds
    sessions: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    task: Mapped["Task"] = relationship("Task", back_populates="history")
