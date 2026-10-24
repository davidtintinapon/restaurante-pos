"""initial_schema

Revision ID: 7e088a64cdc8
Revises: 
Create Date: 2026-10-13 14:33:39.283170
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '7e088a64cdc8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── tenants ───────────────────────────────────────────────────────────────
    op.create_table(
        'tenants',
        sa.Column('id',     sa.String(36),  primary_key=True),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('activo', sa.Boolean(),   nullable=False, server_default='1'),
        sa.Column('creado_en', sa.DateTime(), nullable=True),
    )

    # ── usuarios ──────────────────────────────────────────────────────────────
    op.create_table(
        'usuarios',
        sa.Column('id',            sa.String(36),  primary_key=True),
        sa.Column('tenant_id',     sa.String(36),  sa.ForeignKey('tenants.id'), nullable=True),
        sa.Column('nombre',        sa.String(100), nullable=False),
        sa.Column('email',         sa.String(150), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(200), nullable=False),
        sa.Column('rol',           sa.String(20),  nullable=False),
        sa.Column('activo',        sa.Boolean(),   nullable=False, server_default='1'),
        sa.Column('creado_en',     sa.DateTime(),  nullable=True),
    )
    op.create_index('ix_usuarios_email', 'usuarios', ['email'], unique=True)

    # ── mesas ─────────────────────────────────────────────────────────────────
    op.create_table(
        'mesas',
        sa.Column('id',        sa.String(36),  primary_key=True),
        sa.Column('tenant_id', sa.String(36),  sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('numero',    sa.Integer(),   nullable=False),
        sa.Column('nombre',    sa.String(50),  nullable=True),
        sa.Column('capacidad', sa.Integer(),   nullable=True),
        sa.Column('activa',    sa.Boolean(),   nullable=False, server_default='1'),
    )

    # ── categorias ────────────────────────────────────────────────────────────
    op.create_table(
        'categorias',
        sa.Column('id',        sa.String(36),  primary_key=True),
        sa.Column('tenant_id', sa.String(36),  sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('nombre',    sa.String(100), nullable=False),
        sa.Column('orden',     sa.Integer(),   nullable=False, server_default='0'),
        sa.Column('activa',    sa.Boolean(),   nullable=False, server_default='1'),
    )

    # ── platos ────────────────────────────────────────────────────────────────
    op.create_table(
        'platos',
        sa.Column('id',           sa.String(36),   primary_key=True),
        sa.Column('tenant_id',    sa.String(36),   sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('categoria_id', sa.String(36),   sa.ForeignKey('categorias.id'), nullable=True),
        sa.Column('nombre',       sa.String(150),  nullable=False),
        sa.Column('descripcion',  sa.Text(),       nullable=True),
        sa.Column('precio',       sa.Numeric(10,2),nullable=False),
        sa.Column('disponible',   sa.Boolean(),    nullable=False, server_default='1'),
        sa.Column('imagen_url',   sa.String(500),  nullable=True),
    )

    # ── pedidos ───────────────────────────────────────────────────────────────
    op.create_table(
        'pedidos',
        sa.Column('id',             sa.String(36),  primary_key=True),
        sa.Column('tenant_id',      sa.String(36),  sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('mesa_id',        sa.String(36),  sa.ForeignKey('mesas.id'),   nullable=False),
        sa.Column('mozo_id',        sa.String(36),  sa.ForeignKey('usuarios.id'),nullable=True),
        sa.Column('estado',         sa.String(20),  nullable=False, server_default='abierto'),
        sa.Column('nota_general',   sa.Text(),      nullable=True),
        sa.Column('numero_ticket',  sa.Integer(),   nullable=True),
        sa.Column('creado_en',      sa.DateTime(),  nullable=True),
        sa.Column('cerrado_en',     sa.DateTime(),  nullable=True),
    )

    # ── pedido_items ──────────────────────────────────────────────────────────
    op.create_table(
        'pedido_items',
        sa.Column('id',        sa.String(36),   primary_key=True),
        sa.Column('pedido_id', sa.String(36),   sa.ForeignKey('pedidos.id'),  nullable=False),
        sa.Column('plato_id',  sa.String(36),   sa.ForeignKey('platos.id'),   nullable=True),
        sa.Column('cantidad',  sa.Integer(),    nullable=False, server_default='1'),
        sa.Column('precio_unitario', sa.Numeric(10,2), nullable=False),
        sa.Column('nota',      sa.Text(),       nullable=True),
        sa.Column('estado',    sa.String(20),   nullable=False, server_default='pendiente'),
    )

    # ── gastos ────────────────────────────────────────────────────────────────
    op.create_table(
        'gastos',
        sa.Column('id',          sa.String(36),   primary_key=True),
        sa.Column('tenant_id',   sa.String(36),   sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('descripcion', sa.String(255),  nullable=False),
        sa.Column('monto',       sa.Numeric(10,2),nullable=False),
        sa.Column('categoria',   sa.String(50),   nullable=True),
        sa.Column('fecha',       sa.DateTime(),   nullable=True),
        sa.Column('creado_por',  sa.String(36),   nullable=True),
    )

    # ── configuraciones ───────────────────────────────────────────────────────
    op.create_table(
        'configuraciones',
        sa.Column('id',                 sa.String(36),  primary_key=True),
        sa.Column('tenant_id',          sa.String(36),  sa.ForeignKey('tenants.id'), nullable=False, unique=True),
        sa.Column('nombre_restaurante', sa.String(150), nullable=True),
        sa.Column('ruc',                sa.String(11),  nullable=True),
        sa.Column('direccion',          sa.String(255), nullable=True),
        sa.Column('telefono',           sa.String(20),  nullable=True),
        sa.Column('email',              sa.String(150), nullable=True),
        sa.Column('moneda',             sa.String(5),   nullable=True, server_default='S/.'),
        sa.Column('pie_ticket',         sa.Text(),      nullable=True),
        sa.Column('igv_porcentaje',     sa.String(5),   nullable=True, server_default='18'),
        sa.Column('mostrar_igv',        sa.Boolean(),   nullable=False, server_default='0'),
        sa.Column('printer_ip',         sa.String(50),  nullable=True),
        sa.Column('printer_port',       sa.String(10),  nullable=True, server_default='9100'),
    )


def downgrade() -> None:
    op.drop_table('configuraciones')
    op.drop_table('gastos')
    op.drop_table('pedido_items')
    op.drop_table('pedidos')
    op.drop_table('platos')
    op.drop_table('categorias')
    op.drop_table('mesas')
    op.drop_index('ix_usuarios_email', table_name='usuarios')
    op.drop_table('usuarios')
    op.drop_table('tenants')
