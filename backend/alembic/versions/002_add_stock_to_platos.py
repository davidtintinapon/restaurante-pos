"""add stock to platos

Revision ID: 002_stock_platos
Revises: fbf318a38093
Create Date: 2026-10-13
"""
from alembic import op
import sqlalchemy as sa

revision = '002_stock_platos'
down_revision = 'fbf318a38093'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('platos') as batch_op:
        batch_op.add_column(sa.Column('tiene_stock', sa.Boolean(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('stock', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('platos') as batch_op:
        batch_op.drop_column('stock')
        batch_op.drop_column('tiene_stock')