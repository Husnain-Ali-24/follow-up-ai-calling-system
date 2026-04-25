"""add rescheduled to callstatus

Revision ID: 63b587074ea9
Revises: 5f8d7b2f6c41
Create Date: 2026-04-25 13:57:31.769359

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '63b587074ea9'
down_revision: Union[str, None] = '5f8d7b2f6c41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE callstatus ADD VALUE IF NOT EXISTS 'RESCHEDULED'")


def downgrade() -> None:
    # PostgreSQL enum value removal is not trivial and is intentionally omitted.
    pass
