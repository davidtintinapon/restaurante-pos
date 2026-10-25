"""add mesas.activo column

Revision ID: 010_add_mesas_activo
Revises: 009_add_all_missing_columns
Create Date: 2026-10-25

La DB tenía la columna como 'activa' (nombre antiguo).
El modelo SQLAlchemy usa 'activo'.
Esta migración añade 'activo' idempotentemente.
Si ya existe 'activa', la renombra a 'activo' para consistencia.
"""
from alembic import op
import sqlalchemy as sa

revision = '010_add_mesas_activo'
down_revision = '009_add_all_missing_columns'
branch_labels = None
depends_on = None


def _col_exists(conn, table, column):
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    return result.fetchone() is not None


def upgrade():
    conn = op.get_bind()

    activo_exists = _col_exists(conn, 'mesas', 'activo')
    activa_exists = _col_exists(conn, 'mesas', 'activa')

    if activo_exists:
        # Ya existe, nada que hacer
        pass
    elif activa_exists:
        # Renombrar 'activa' -> 'activo' para alinearlo con el modelo
        conn.execute(sa.text(
            "ALTER TABLE mesas RENAME COLUMN activa TO activo"
        ))
    else:
        # No existe ninguna, añadir
        op.add_column('mesas', sa.Column('activo', sa.Boolean(), nullable=True, server_default='true'))


def downgrade():
    pass
