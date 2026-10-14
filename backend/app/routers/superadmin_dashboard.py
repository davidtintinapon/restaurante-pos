from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from ..core.database import get_db
from ..deps import require_superadmin
from ..models.tenant import Tenant
from ..models.usuario import Usuario

router = APIRouter(prefix="/superadmin/dashboard", tags=["superadmin-dashboard"])

PRECIO_PLAN = {"basico": 150, "estandar": 250, "pro": 400}


@router.get("")
def dashboard_superadmin(
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    ahora = datetime.utcnow()
    en_7_dias = ahora + timedelta(days=7)

    tenants = db.query(Tenant).all()

    activos    = [t for t in tenants if t.activo]
    suspendidos = [t for t in tenants if not t.activo]
    por_vencer = [
        t for t in activos
        if t.vence_en and t.vence_en <= en_7_dias
    ]

    # Ingresos estimados del mes: tenants activos × precio de su plan
    ingresos_mes = sum(PRECIO_PLAN.get(t.plan, 150) for t in activos)

    total_usuarios = db.query(Usuario).filter(Usuario.activo == True).count()

    tenants_detalle = sorted([
        {
            "id": t.id,
            "nombre": t.nombre,
            "slug": t.slug,
            "plan": t.plan,
            "activo": t.activo,
            "vence_en": t.vence_en,
            "max_usuarios": t.max_usuarios,
            "max_mesas": t.max_mesas,
            "creado_en": t.creado_en,
        }
        for t in tenants
    ], key=lambda x: x["nombre"])

    return {
        "tenants_activos": len(activos),
        "tenants_suspendidos": len(suspendidos),
        "tenants_total": len(tenants),
        "tenants_por_vencer": len(por_vencer),
        "ingresos_mes_estimado": ingresos_mes,
        "total_usuarios": total_usuarios,
        "tenants": tenants_detalle,
    }
