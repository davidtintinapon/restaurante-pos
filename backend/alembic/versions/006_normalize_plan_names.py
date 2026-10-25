"""Normaliza nombres de plan a basico/pro/premium y ajusta max_usuarios por plan.

Revision ID: 006_normalize_plan_names
Revises: 005_add_plan_fields_to_tenants
"""
from alembic import op
import sqlalchemy as sa

revision = '006_normalize_plan_names'
down_revision = '005_add_plan_fields_to_tenants'
branch_labels = None
depends_on = None


def upgrade():
    # Normalizar nombres de plan que puedan venir de versiones anteriores
    op.execute("UPDATE tenants SET plan = 'basico'  WHERE plan IN ('estandar', 'basic', 'Basico', 'Básico')")
    op.execute("UPDATE tenants SET plan = 'pro'     WHERE plan IN ('Pro', 'PRO')")
    op.execute("UPDATE tenants SET plan = 'premium' WHERE plan IN ('Premium', 'PREMIUM')")

    # Asegurar que cualquier plan NULL o desconocido quede en basico
    op.execute("UPDATE tenants SET plan = 'basico' WHERE plan IS NULL OR plan NOT IN ('basico', 'pro', 'premium')")

    # Ajustar max_usuarios según el plan para tenants que tengan el default 10
    # (el default anterior era 10 para todos; ahora basico=2, pro=5, premium=999)
    op.execute("""
        UPDATE tenants
        SET max_usuarios = 2
        WHERE plan = 'basico' AND (max_usuarios IS NULL OR max_usuarios = 10)
    """)
    op.execute("""
        UPDATE tenants
        SET max_usuarios = 5
        WHERE plan = 'pro' AND (max_usuarios IS NULL OR max_usuarios = 10)
    """)
    op.execute("""
        UPDATE tenants
        SET max_usuarios = 999
        WHERE plan = 'premium' AND (max_usuarios IS NULL OR max_usuarios = 10)
    """)

    # Asegurar valor por defecto para max_mesas si es NULL
    op.execute("UPDATE tenants SET max_mesas = 20 WHERE max_mesas IS NULL")


def downgrade():
    # No hay downgrade significativo — sólo restauramos el default de usuarios
    op.execute("UPDATE tenants SET max_usuarios = 10 WHERE max_usuarios IS NULL")
