"""fix pedidos: add hora_apertura, total, and items_pedido table alias

Revision ID: 013_fix_pedidos_columns
Revises: 012_fix_null_defaults
Create Date: 2026-10-25

La tabla pedidos fue creada con columnas 'creado_en'/'cerrado_en' pero el modelo
usa 'hora_apertura'/'hora_cierre'. Esta migración añade las columnas faltantes
de forma idempotente y crea items_pedido si solo existe pedido_items.
"""
from alembic import op
import sqlalchemy as sa

revision = '013_fix_pedidos_columns'
down_revision = '012_fix_null_defaults'
branch_labels = None
depends_on = None


def _col_exists(conn, table, column):
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name=:t AND column_name=:c"
    ), {"t": table, "c": column})
    return result.fetchone() is not None


def _table_exists(conn, table):
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_name=:t"
    ), {"t": table})
    return result.fetchone() is not None


def upgrade():
    conn = op.get_bind()

    # ── pedidos: columnas que faltan ──────────────────────────────────────────

    # hora_apertura (el modelo la necesita; la DB puede tener 'creado_en')
    if not _col_exists(conn, 'pedidos', 'hora_apertura'):
        op.add_column('pedidos', sa.Column(
            'hora_apertura', sa.DateTime(), nullable=True,
            server_default=sa.text('NOW()')
        ))
        # Si ya hay filas con creado_en, copiar ese valor
        if _col_exists(conn, 'pedidos', 'creado_en'):
            conn.execute(sa.text(
                "UPDATE pedidos SET hora_apertura = creado_en WHERE hora_apertura IS NULL AND creado_en IS NOT NULL"
            ))
        # Filas sin ninguna fecha → ahora
        conn.execute(sa.text(
            "UPDATE pedidos SET hora_apertura = NOW() WHERE hora_apertura IS NULL"
        ))

    # hora_cierre (008 debió añadirla; por si acaso)
    if not _col_exists(conn, 'pedidos', 'hora_cierre'):
        op.add_column('pedidos', sa.Column('hora_cierre', sa.DateTime(), nullable=True))
        # Copiar cerrado_en si existe
        if _col_exists(conn, 'pedidos', 'cerrado_en'):
            conn.execute(sa.text(
                "UPDATE pedidos SET hora_cierre = cerrado_en WHERE hora_cierre IS NULL AND cerrado_en IS NOT NULL"
            ))

    # total
    if not _col_exists(conn, 'pedidos', 'total'):
        op.add_column('pedidos', sa.Column(
            'total', sa.Numeric(10, 2), nullable=True, server_default='0'
        ))
        conn.execute(sa.text("UPDATE pedidos SET total = 0 WHERE total IS NULL"))

    # metodo_pago (008 debió añadirlo; por si acaso)
    if not _col_exists(conn, 'pedidos', 'metodo_pago'):
        op.add_column('pedidos', sa.Column('metodo_pago', sa.String(30), nullable=True))

    # pagado (008 debió añadirlo; por si acaso)
    if not _col_exists(conn, 'pedidos', 'pagado'):
        op.add_column('pedidos', sa.Column(
            'pagado', sa.Boolean(), nullable=True, server_default='false'
        ))
        conn.execute(sa.text("UPDATE pedidos SET pagado = false WHERE pagado IS NULL"))

    # tipo (011 debió añadirlo; por si acaso)
    if not _col_exists(conn, 'pedidos', 'tipo'):
        op.add_column('pedidos', sa.Column(
            'tipo', sa.String(20), nullable=True, server_default='mesa'
        ))
        conn.execute(sa.text("UPDATE pedidos SET tipo = 'mesa' WHERE tipo IS NULL"))

    # nombre_cliente (011 lo añadió como 'nombre_cliente'; por si acaso)
    if not _col_exists(conn, 'pedidos', 'nombre_cliente'):
        op.add_column('pedidos', sa.Column('nombre_cliente', sa.String(100), nullable=True))

    # telefono_delivery (008 lo añadió)
    if not _col_exists(conn, 'pedidos', 'telefono_delivery'):
        op.add_column('pedidos', sa.Column('telefono_delivery', sa.String(20), nullable=True))

    # direccion_delivery (008 lo añadió)
    if not _col_exists(conn, 'pedidos', 'direccion_delivery'):
        op.add_column('pedidos', sa.Column('direccion_delivery', sa.String(200), nullable=True))

    # nota_general (schema inicial la tenía; por si acaso)
    if not _col_exists(conn, 'pedidos', 'nota_general'):
        op.add_column('pedidos', sa.Column('nota_general', sa.Text(), nullable=True))

    # numero_ticket (schema inicial lo tenía; por si acaso)
    if not _col_exists(conn, 'pedidos', 'numero_ticket'):
        op.add_column('pedidos', sa.Column('numero_ticket', sa.Integer(), nullable=True))

    # ── items_pedido: crear si no existe (el schema inicial la llamó pedido_items) ──
    if not _table_exists(conn, 'items_pedido'):
        op.create_table(
            'items_pedido',
            sa.Column('id',            sa.String(36),    primary_key=True),
            sa.Column('pedido_id',     sa.String(36),    sa.ForeignKey('pedidos.id'), nullable=False),
            sa.Column('plato_id',      sa.String(36),    sa.ForeignKey('platos.id'),  nullable=True),
            sa.Column('cantidad',      sa.Integer(),     nullable=False, server_default='1'),
            sa.Column('precio_unitario', sa.Numeric(10, 2), nullable=False),
            sa.Column('estado',        sa.String(20),    nullable=True, server_default='pendiente'),
            sa.Column('nota',          sa.String(200),   nullable=True),
        )


def downgrade():
    pass
