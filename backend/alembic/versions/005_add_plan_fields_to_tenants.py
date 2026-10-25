"""add plan fields to tenants

Revision ID: 005_add_plan_fields_to_tenants
Revises: 004_add_slug_to_tenants
Create Date: 2026-10-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_add_plan_fields_to_tenants'
down_revision: Union[str, Sequence[str], None] = '004_add_slug_to_tenants'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('plan', sa.String(20), nullable=True))
    op.add_column('tenants', sa.Column('vence_en', sa.DateTime(), nullable=True))
    op.add_column('tenants', sa.Column('max_usuarios', sa.Integer(), nullable=True))
    op.add_column('tenants', sa.Column('max_mesas', sa.Integer(), nullable=True))

    # Valores por defecto para filas existentes
    op.execute("UPDATE tenants SET plan = 'basico' WHERE plan IS NULL")
    op.execute("UPDATE tenants SET max_usuarios = 10 WHERE max_usuarios IS NULL")
    op.execute("UPDATE tenants SET max_mesas = 20 WHERE max_mesas IS NULL")


def downgrade() -> None:
    op.drop_column('tenants', 'max_mesas')
    op.drop_column('tenants', 'max_usuarios')
    op.drop_column('tenants', 'vence_en')
    op.drop_column('tenants', 'plan')
