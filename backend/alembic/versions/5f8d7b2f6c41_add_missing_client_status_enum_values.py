"""add missing client status enum values

Revision ID: 5f8d7b2f6c41
Revises: b2f8a7b7f3f1
Create Date: 2026-04-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "5f8d7b2f6c41"
down_revision: Union[str, None] = "b2f8a7b7f3f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE clientstatus ADD VALUE IF NOT EXISTS 'QUEUED'")
    op.execute("ALTER TYPE clientstatus ADD VALUE IF NOT EXISTS 'REFUSED'")
    op.execute(
        "ALTER TYPE clientstatus ADD VALUE IF NOT EXISTS 'MANUAL_FOLLOW_UP_REQUIRED'"
    )


def downgrade() -> None:
    # PostgreSQL enum value removal is not trivial and is intentionally omitted.
    pass
