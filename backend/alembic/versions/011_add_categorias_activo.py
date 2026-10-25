"""add categorias.activo and other missing boolean columns

Revision ID: 011_add_categorias_activo
Revises: 010_add_mesas_activo
Create Date: 2026-10-25

La migración 009 olvidó añadir categorias.activo.
El query en /carta/ filtra por Categoria.activo == True → 500 si no existe.
"""
from alembic import op
import sqlalchemy as sa

revision = '011_add_categorias_activo'
down_revision = '010_add_mesas_activo'
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

    # categorias.activo — el query /carta/ filtra por esto
    if not _col_exists(conn, 'categorias', 'activo'):
        op.add_column('categorias', sa.Column('activo', sa.Boolean(), nullable=True, server_default='true'))

    # platos.disponible — usado en el router de carta para filtrar mozos/cocineros
    if not _col_exists(conn, 'platos', 'disponible'):
        op.add_column('platos', sa.Column('disponible', sa.Boolean(), nullable=True, server_default='true'))

    # pedidos.tipo — llevar/delivery usan esto
    if not _col_exists(conn, 'pedidos', 'tipo'):
        op.add_column('pedidos', sa.Column('tipo', sa.String(20), nullable=True, server_default='mesa'))

    # pedidos.direccion_entrega — delivery
    if not _col_exists(conn, 'pedidos', 'direccion_entrega'):
        op.add_column('pedidos', sa.Column('direccion_entrega', sa.String(200), nullable=True))

    # pedidos.telefono_cliente — llevar/delivery
    if not _col_exists(conn, 'pedidos', 'telefono_cliente'):
        op.add_column('pedidos', sa.Column('telefono_cliente', sa.String(30), nullable=True))

    # pedidos.nombre_cliente
    if not _col_exists(conn, 'pedidos', 'nombre_cliente'):
        op.add_column('pedidos', sa.Column('nombre_cliente', sa.String(100), nullable=True))


def downgrade():
    pass
