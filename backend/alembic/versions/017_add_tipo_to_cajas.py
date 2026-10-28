"""017_add_tipo_to_cajas

Revision ID: 017_add_tipo_to_cajas
Revises: 016_fix_plan_premium
Create Date: 2026-10-28
"""
from alembic import op
import sqlalchemy as sa

revision = '017_add_tipo_to_cajas'
down_revision = '016_fix_plan_premium'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('cajas', sa.Column('tipo', sa.String(10), nullable=False, server_default='caja'))


def downgrade():
    op.drop_column('cajas', 'tipo')
