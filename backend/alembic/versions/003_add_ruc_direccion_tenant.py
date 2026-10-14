from alembic import op
import sqlalchemy as sa

revision = '003_ruc_direccion_tenant'
down_revision = '002_stock_platos'
branch_labels = None
depends_on = None

def upgrade() -> None:
    with op.batch_alter_table('tenants') as batch_op:
        batch_op.add_column(sa.Column('ruc', sa.String(11), nullable=True))
        batch_op.add_column(sa.Column('direccion', sa.String(255), nullable=True))

def downgrade() -> None:
    with op.batch_alter_table('tenants') as batch_op:
        batch_op.drop_column('direccion')
        batch_op.drop_column('ruc')