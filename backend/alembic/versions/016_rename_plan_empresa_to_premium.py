"""016_rename_plan_empresa_to_premium

Revision ID: 016_rename_plan_empresa_to_premium
Revises: 015_add_cajas
Create Date: 2026-10-28
"""
from alembic import op

revision = '016_rename_plan_empresa_to_premium'
down_revision = '015_add_cajas'
branch_labels = None
depends_on = None


def upgrade():
    # Si quedaron tenants con plan='empresa' (nombre anterior), los corregimos a 'premium'
    op.execute("UPDATE tenants SET plan = 'premium' WHERE plan = 'empresa'")


def downgrade():
    op.execute("UPDATE tenants SET plan = 'empresa' WHERE plan = 'premium'")
