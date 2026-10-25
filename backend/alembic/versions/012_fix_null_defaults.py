"""fix null values in columns that should have defaults

Revision ID: 012_fix_null_defaults
Revises: 011_add_categorias_activo
Create Date: 2026-10-25

Las columnas añadidas por migraciones anteriores tienen server_default
pero las filas ya existentes (o insertadas antes del server_default)
pueden tener NULL. Esto causa errores de validación en Pydantic (campos
no-opcionales con valor NULL).
"""
from alembic import op
import sqlalchemy as sa

revision = '012_fix_null_defaults'
down_revision = '011_add_categorias_activo'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # mesas — rellenar NULLs con defaults
    conn.execute(sa.text("UPDATE mesas SET zona = 'salon' WHERE zona IS NULL"))
    conn.execute(sa.text("UPDATE mesas SET estado = 'libre' WHERE estado IS NULL"))
    conn.execute(sa.text("UPDATE mesas SET capacidad = 4 WHERE capacidad IS NULL"))
    conn.execute(sa.text("UPDATE mesas SET activo = true WHERE activo IS NULL"))

    # categorias
    conn.execute(sa.text("UPDATE categorias SET activo = true WHERE activo IS NULL"))
    conn.execute(sa.text("UPDATE categorias SET orden = 0 WHERE orden IS NULL"))

    # platos
    conn.execute(sa.text("UPDATE platos SET disponible = true WHERE disponible IS NULL"))
    conn.execute(sa.text("UPDATE platos SET tiene_stock = false WHERE tiene_stock IS NULL"))
    conn.execute(sa.text("UPDATE platos SET stock = 0 WHERE stock IS NULL"))

    # pedidos
    conn.execute(sa.text("UPDATE pedidos SET tipo = 'mesa' WHERE tipo IS NULL"))
    conn.execute(sa.text("UPDATE pedidos SET pagado = false WHERE pagado IS NULL"))


def downgrade():
    pass
