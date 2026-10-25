"""add missing columns: pedidos.total, platos.creado_en

Revision ID: 007_add_missing_columns
Revises: 006_normalize_plan_names
Create Date: 2026-10-24
"""
from alembic import op
import sqlalchemy as sa

revision = '007_add_missing_columns'
down_revision = '006_normalize_plan_names'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # Añadir pedidos.total si no existe
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='pedidos' AND column_name='total'"
    ))
    if not result.fetchone():
        op.add_column('pedidos', sa.Column('total', sa.Numeric(10, 2), nullable=True, server_default='0'))

    # Añadir platos.creado_en si no existe
    result = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='platos' AND column_name='creado_en'"
    ))
    if not result.fetchone():
        op.add_column('platos', sa.Column('creado_en', sa.DateTime(), nullable=True,
                                          server_default=sa.text('NOW()')))


def downgrade():
    op.drop_column('pedidos', 'total')
    op.drop_column('platos', 'creado_en')
