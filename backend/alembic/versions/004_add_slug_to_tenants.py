"""add slug to tenants

Revision ID: 004_add_slug_to_tenants
Revises: 003_ruc_direccion_tenant
Create Date: 2026-10-24

"""
from alembic import op
import sqlalchemy as sa

revision = '004_add_slug_to_tenants'
down_revision = '003_ruc_direccion_tenant'
branch_labels = None
depends_on = None


def upgrade():
    # Agregar columna slug como nullable primero
    op.add_column('tenants', sa.Column('slug', sa.String(80), nullable=True))
    
    # Rellenar slug con el id para los tenants existentes (único garantizado)
    op.execute("UPDATE tenants SET slug = id WHERE slug IS NULL")
    
    # Hacer NOT NULL y agregar índice único
    op.alter_column('tenants', 'slug', nullable=False)
    op.create_unique_constraint('uq_tenants_slug', 'tenants', ['slug'])
    op.create_index('ix_tenants_slug', 'tenants', ['slug'], unique=True)


def downgrade():
    op.drop_index('ix_tenants_slug', table_name='tenants')
    op.drop_constraint('uq_tenants_slug', 'tenants', type_='unique')
    op.drop_column('tenants', 'slug')
