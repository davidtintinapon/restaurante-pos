"""015_add_cajas

Revision ID: 015_add_cajas
Revises: 014_add_zonas
Create Date: 2026-10-28
"""
from alembic import op
import sqlalchemy as sa

revision = '015_add_cajas'
down_revision = '014_add_zonas'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'cajas',
        sa.Column('id',           sa.String(36),  primary_key=True),
        sa.Column('tenant_id',    sa.String(36),  nullable=False),
        sa.Column('nombre',       sa.String(100), nullable=False),
        sa.Column('printer_ip',   sa.String(50),  nullable=True),
        sa.Column('printer_port', sa.String(10),  nullable=True, server_default='9100'),
        sa.Column('activo',       sa.Boolean(),   nullable=False, server_default='1'),
        sa.Column('creado_en',    sa.DateTime(),  server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], name='fk_cajas_tenant'),
    )
    op.create_index('ix_cajas_tenant_id', 'cajas', ['tenant_id'])


def downgrade():
    op.drop_index('ix_cajas_tenant_id', table_name='cajas')
    op.drop_table('cajas')
