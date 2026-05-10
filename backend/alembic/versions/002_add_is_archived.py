"""add is_archived to tasks

Revision ID: 002_add_is_archived
Revises: 001_initial
Create Date: 2026-05-10
"""
from alembic import op
import sqlalchemy as sa

revision = '002_add_is_archived'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tasks', sa.Column('is_archived', sa.Boolean(), nullable=False, server_default='false'))
    op.create_index('ix_tasks_is_archived', 'tasks', ['is_archived'])


def downgrade():
    op.drop_index('ix_tasks_is_archived', table_name='tasks')
    op.drop_column('tasks', 'is_archived')
