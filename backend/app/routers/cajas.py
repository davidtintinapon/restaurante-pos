from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..core.database import get_db
from ..deps import get_current_user, require_admin
from ..models import Usuario, Tenant
from ..models.caja import Caja
from ..schemas.tenant import _PLAN_LIMITS

router = APIRouter(prefix="/cajas", tags=["cajas"])


def _max_cajas_plan(plan: str) -> int:
    """Retorna el límite de cajas del plan. 0 = ilimitado."""
    return _PLAN_LIMITS.get(plan, _PLAN_LIMITS["basico"])["max_cajas"]


class CajaOut(BaseModel):
    id:           str
    nombre:       str
    printer_ip:   Optional[str] = None
    printer_port: str = "9100"
    activo:       bool
    model_config = {"from_attributes": True}


class CajaCreate(BaseModel):
    nombre:       str
    printer_ip:   Optional[str] = None
    printer_port: Optional[str] = "9100"


class CajaUpdate(BaseModel):
    nombre:       Optional[str] = None
    printer_ip:   Optional[str] = None
    printer_port: Optional[str] = None


@router.get("/", response_model=list[CajaOut])
def listar_cajas(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return (
        db.query(Caja)
        .filter(Caja.tenant_id == user.tenant_id, Caja.activo == True)
        .order_by(Caja.creado_en)
        .all()
    )


@router.post("/", response_model=CajaOut)
def crear_caja(
    data: CajaCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    max_cajas = _max_cajas_plan(tenant.plan)

    if max_cajas > 0:  # 0 = ilimitado
        total = db.query(Caja).filter(
            Caja.tenant_id == user.tenant_id,
            Caja.activo == True,
        ).count()
        if total >= max_cajas:
            nombres = {1: "una caja", 2: "dos cajas"}
            limite_str = nombres.get(max_cajas, f"{max_cajas} cajas")
            raise HTTPException(
                status_code=400,
                detail=f"Tu plan {tenant.plan.capitalize()} solo permite {limite_str}. Actualiza tu plan para agregar más.",
            )

    caja = Caja(
        tenant_id=user.tenant_id,
        nombre=data.nombre,
        printer_ip=data.printer_ip,
        printer_port=data.printer_port or "9100",
    )
    db.add(caja)
    db.commit()
    db.refresh(caja)
    return caja


@router.patch("/{caja_id}", response_model=CajaOut)
def actualizar_caja(
    caja_id: str,
    data: CajaUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    caja = db.query(Caja).filter(
        Caja.id == caja_id,
        Caja.tenant_id == user.tenant_id,
        Caja.activo == True,
    ).first()
    if not caja:
        raise HTTPException(status_code=404, detail="Caja no encontrada")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(caja, field, value)
    db.commit()
    db.refresh(caja)
    return caja


@router.delete("/{caja_id}")
def eliminar_caja(
    caja_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    caja = db.query(Caja).filter(
        Caja.id == caja_id,
        Caja.tenant_id == user.tenant_id,
        Caja.activo == True,
    ).first()
    if not caja:
        raise HTTPException(status_code=404, detail="Caja no encontrada")

    caja.activo = False
    db.commit()
    return {"ok": True}
