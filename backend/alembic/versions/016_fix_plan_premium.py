"""016_fix_plan_premium

Revision ID: 016_fix_plan_premium
Revises: 015_add_cajas
Create Date: 2026-10-28
"""
from alembic import op

revision = '016_fix_plan_premium'
down_revision = '015_add_cajas'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE tenants SET plan = 'premium' WHERE plan = 'empresa'")


def downgrade():
    op.execute("UPDATE tenants SET plan = 'empresa' WHERE plan = 'premium'")
