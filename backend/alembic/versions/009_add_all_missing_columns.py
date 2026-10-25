"""add all missing columns across all tables

Revision ID: 009_add_all_missing_columns
Revises: 008_add_pedidos_missing_columns
Create Date: 2026-10-25

Cubre todas las columnas que existen en los modelos SQLAlchemy
pero que pueden no existir en la DB de producción.
Todas las operaciones son idempotentes (verifican antes de añadir).
"""
from alembic import op
import sqlalchemy as sa

revision = '009_add_all_missing_columns'
down_revision = '008_add_pedidos_missing_columns'
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

    # ── mesas ─────────────────────────────────────────────────────────────────
    if not _col_exists(conn, 'mesas', 'nombre'):
        op.add_column('mesas', sa.Column('nombre', sa.String(50), nullable=True))

    if not _col_exists(conn, 'mesas', 'capacidad'):
        op.add_column('mesas', sa.Column('capacidad', sa.Integer(), nullable=True, server_default='4'))

    if not _col_exists(conn, 'mesas', 'zona'):
        op.add_column('mesas', sa.Column('zona', sa.String(50), nullable=True, server_default='salon'))

    if not _col_exists(conn, 'mesas', 'estado'):
        op.add_column('mesas', sa.Column('estado', sa.String(20), nullable=True, server_default='libre'))

    if not _col_exists(conn, 'mesas', 'creado_en'):
        op.add_column('mesas', sa.Column('creado_en', sa.DateTime(), nullable=True,
                                         server_default=sa.text('NOW()')))

    # ── platos ────────────────────────────────────────────────────────────────
    if not _col_exists(conn, 'platos', 'tiene_stock'):
        op.add_column('platos', sa.Column('tiene_stock', sa.Boolean(), nullable=True, server_default='false'))

    if not _col_exists(conn, 'platos', 'stock'):
        op.add_column('platos', sa.Column('stock', sa.Integer(), nullable=True, server_default='0'))

    # ── categorias ────────────────────────────────────────────────────────────
    if not _col_exists(conn, 'categorias', 'orden'):
        op.add_column('categorias', sa.Column('orden', sa.Integer(), nullable=True, server_default='0'))

    # ── gastos_caja ───────────────────────────────────────────────────────────
    if not _col_exists(conn, 'gastos_caja', 'categoria'):
        op.add_column('gastos_caja', sa.Column('categoria', sa.String(30), nullable=True, server_default='otros'))

    # ── configuraciones ───────────────────────────────────────────────────────
    for col_name, col_def in [
        ('nombre_restaurante', sa.Column('nombre_restaurante', sa.String(150), nullable=True, server_default='Mi Restaurante')),
        ('ruc',                sa.Column('ruc',                sa.String(20),  nullable=True)),
        ('direccion',          sa.Column('direccion',          sa.String(200), nullable=True)),
        ('telefono',           sa.Column('telefono',           sa.String(30),  nullable=True)),
        ('email',              sa.Column('email',              sa.String(100), nullable=True)),
        ('moneda',             sa.Column('moneda',             sa.String(10),  nullable=True, server_default='S/.')),
        ('pie_ticket',         sa.Column('pie_ticket',         sa.String(200), nullable=True)),
        ('igv_porcentaje',     sa.Column('igv_porcentaje',     sa.String(5),   nullable=True, server_default='18')),
        ('mostrar_igv',        sa.Column('mostrar_igv',        sa.Boolean(),   nullable=True, server_default='false')),
        ('printer_ip',         sa.Column('printer_ip',         sa.String(50),  nullable=True)),
        ('printer_port',       sa.Column('printer_port',       sa.String(10),  nullable=True, server_default='9100')),
    ]:
        if not _col_exists(conn, 'configuraciones', col_name):
            op.add_column('configuraciones', col_def)


def downgrade():
    # mesas
    for c in ['nombre', 'capacidad', 'zona', 'estado', 'creado_en']:
        op.drop_column('mesas', c)
    # platos
    for c in ['tiene_stock', 'stock']:
        op.drop_column('platos', c)
    # categorias
    op.drop_column('categorias', 'orden')
    # gastos_caja
    op.drop_column('gastos_caja', 'categoria')
    # configuraciones
    for c in ['nombre_restaurante','ruc','direccion','telefono','email',
              'moneda','pie_ticket','igv_porcentaje','mostrar_igv','printer_ip','printer_port']:
        op.drop_column('configuraciones', c)
