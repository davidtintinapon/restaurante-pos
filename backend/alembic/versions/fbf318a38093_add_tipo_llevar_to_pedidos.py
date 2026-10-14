"""add_tipo_llevar_to_pedidos

Revision ID: fbf318a38093
Revises: 7e088a64cdc8
Create Date: 2026-10-13

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'fbf318a38093'
down_revision: Union[str, None] = '7e088a64cdc8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Agregar columna tipo (salon, llevar)
    op.add_column('pedidos', sa.Column('tipo', sa.String(20), nullable=True))
    # Agregar columna nombre_cliente para pedidos LLEVAR
    op.add_column('pedidos', sa.Column('nombre_cliente', sa.String(100), nullable=True))
    # Hacer mesa_id nullable para pedidos LLEVAR
    with op.batch_alter_table('pedidos') as batch_op:
        batch_op.alter_column('mesa_id', existing_type=sa.String(36), nullable=True)
    # Poner 'salon' como valor por defecto en registros existentes
    op.execute("UPDATE pedidos SET tipo = 'salon' WHERE tipo IS NULL")


def downgrade() -> None:
    with op.batch_alter_table('pedidos') as batch_op:
        batch_op.alter_column('mesa_id', existing_type=sa.String(36), nullable=False)
    op.drop_column('pedidos', 'nombre_cliente')
    op.drop_column('pedidos', 'tipo')