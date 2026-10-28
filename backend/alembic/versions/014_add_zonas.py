"""add zonas table

Revision ID: 014
Revises: 013
Create Date: 2026-10-28
"""
from alembic import op
import sqlalchemy as sa

revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'zonas',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('nombre', sa.String(100), nullable=False),
        sa.Column('orden', sa.Integer(), default=0),
        sa.Column('activo', sa.Boolean(), default=True),
        sa.Column('creado_en', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_zonas_tenant_id', 'zonas', ['tenant_id'])

def downgrade():
    op.drop_index('ix_zonas_tenant_id', 'zonas')
    op.drop_table('zonas')
