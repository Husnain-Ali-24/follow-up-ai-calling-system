"""add app settings table

Revision ID: b2f8a7b7f3f1
Revises: 77e748f561b0
Create Date: 2026-04-22 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2f8a7b7f3f1'
down_revision: Union[str, None] = '77e748f561b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'app_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('calling_window_start', sa.String(length=5), nullable=False, server_default='09:00'),
        sa.Column('calling_window_end', sa.String(length=5), nullable=False, server_default='17:00'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    op.bulk_insert(
        sa.table(
            'app_settings',
            sa.column('id', sa.Integer()),
            sa.column('calling_window_start', sa.String(length=5)),
            sa.column('calling_window_end', sa.String(length=5)),
        ),
        [{'id': 1, 'calling_window_start': '09:00', 'calling_window_end': '17:00'}],
    )


def downgrade() -> None:
    op.drop_table('app_settings')
