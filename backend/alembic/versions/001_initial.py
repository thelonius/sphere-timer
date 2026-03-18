"""Initial schema — users, tasks, task_history

Revision ID: 001
Revises:
Create Date: 2026-03-17
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(50), unique=True, nullable=False),
        sa.Column("email", sa.String(100), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_users_email", "users", ["email"])
    op.create_index("idx_users_username", "users", ["username"])

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("total_time", sa.BigInteger(), default=0),
        sa.Column("is_active", sa.Boolean(), default=False),
        sa.Column("start_time", sa.BigInteger(), nullable=True),
        sa.Column("order_index", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("idx_tasks_user_id", "tasks", ["user_id"])
    op.create_index("idx_tasks_is_active", "tasks", ["is_active"])

    op.create_table(
        "task_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("time", sa.BigInteger(), nullable=False),
        sa.Column("sessions", sa.Integer(), default=1),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("task_id", "date", name="uq_task_history_task_date"),
    )
    op.create_index("idx_task_history_task_id", "task_history", ["task_id"])
    op.create_index("idx_task_history_date", "task_history", ["date"])


def downgrade():
    op.drop_table("task_history")
    op.drop_table("tasks")
    op.drop_table("users")
