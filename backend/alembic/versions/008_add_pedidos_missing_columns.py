"""add missing pedidos columns: hora_cierre, metodo_pago, pagado, nota_general, numero_ticket, telefono_delivery, direccion_delivery

Revision ID: 008_add_pedidos_missing_columns
Revises: 007_add_missing_columns
Create Date: 2026-10-25
"""
from alembic import op
import sqlalchemy as sa

revision = '008_add_pedidos_missing_columns'
down_revision = '007_add_missing_columns'
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

    # pedidos.hora_cierre
    if not _col_exists(conn, 'pedidos', 'hora_cierre'):
        op.add_column('pedidos', sa.Column('hora_cierre', sa.DateTime(), nullable=True))

    # pedidos.metodo_pago
    if not _col_exists(conn, 'pedidos', 'metodo_pago'):
        op.add_column('pedidos', sa.Column('metodo_pago', sa.String(30), nullable=True))

    # pedidos.pagado
    if not _col_exists(conn, 'pedidos', 'pagado'):
        op.add_column('pedidos', sa.Column('pagado', sa.Boolean(), nullable=True, server_default='false'))

    # pedidos.nota_general
    if not _col_exists(conn, 'pedidos', 'nota_general'):
        op.add_column('pedidos', sa.Column('nota_general', sa.Text(), nullable=True))

    # pedidos.numero_ticket
    if not _col_exists(conn, 'pedidos', 'numero_ticket'):
        op.add_column('pedidos', sa.Column('numero_ticket', sa.Integer(), nullable=True))

    # pedidos.telefono_delivery
    if not _col_exists(conn, 'pedidos', 'telefono_delivery'):
        op.add_column('pedidos', sa.Column('telefono_delivery', sa.String(20), nullable=True))

    # pedidos.direccion_delivery
    if not _col_exists(conn, 'pedidos', 'direccion_delivery'):
        op.add_column('pedidos', sa.Column('direccion_delivery', sa.String(200), nullable=True))


def downgrade():
    op.drop_column('pedidos', 'hora_cierre')
    op.drop_column('pedidos', 'metodo_pago')
    op.drop_column('pedidos', 'pagado')
    op.drop_column('pedidos', 'nota_general')
    op.drop_column('pedidos', 'numero_ticket')
    op.drop_column('pedidos', 'telefono_delivery')
    op.drop_column('pedidos', 'direccion_delivery')
