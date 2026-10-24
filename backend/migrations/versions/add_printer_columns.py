"""add printer_ip and printer_port to configuraciones

Revision ID: add_printer_cols
Revises:
Create Date: 2026-10-21

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_printer_cols'
down_revision = None   # ← pon aquí el ID de tu última migración si ya tienes otras
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('configuraciones',
        sa.Column('printer_ip', sa.String(50), nullable=True)
    )
    op.add_column('configuraciones',
        sa.Column('printer_port', sa.String(10), nullable=True, server_default='9100')
    )


def downgrade() -> None:
    op.drop_column('configuraciones', 'printer_port')
    op.drop_column('configuraciones', 'printer_ip')
