from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Literal
from ..core.database import get_db
from ..deps import get_current_user, require_admin
from ..models import Usuario, Tenant
from ..models.caja import Caja
from ..schemas.tenant import _PLAN_LIMITS

router = APIRouter(prefix="/cajas", tags=["cajas"])


def _max_cajas_plan(plan: str) -> int:
    """Retorna el límite TOTAL de cajas del plan. 0 = ilimitado."""
    return _PLAN_LIMITS.get(plan, _PLAN_LIMITS["basico"])["max_cajas"]


def _validar_tipo_por_plan(plan: str, tipo: str, tenant_id: str, db: Session, exclude_id: str = None):
    """
    Valida que el plan permita agregar una caja del tipo indicado.
    - basico  (max_cajas=1): 1 caja en total, cualquier tipo
    - pro     (max_cajas=2): máximo 1 de tipo 'caja' Y 1 de tipo 'cocina'
    - premium (max_cajas=0): sin límite
    Lanza HTTPException 400 si se supera el límite.
    """
    max_cajas = _max_cajas_plan(plan)

    if max_cajas == 0:
        return  # premium: ilimitado

    q = db.query(Caja).filter(Caja.tenant_id == tenant_id, Caja.activo == True)
    if exclude_id:
        q = q.filter(Caja.id != exclude_id)

    if max_cajas == 1:
        # básico: solo 1 caja total (cualquier tipo)
        total = q.count()
        if total >= 1:
            raise HTTPException(
                status_code=400,
                detail="Tu plan Básico solo permite una caja en total. Actualiza tu plan para agregar más.",
            )

    elif max_cajas == 2:
        # pro: máximo 1 por tipo
        total_tipo = q.filter(Caja.tipo == tipo).count()
        if total_tipo >= 1:
            label = "caja" if tipo == "caja" else "cocina"
            raise HTTPException(
                status_code=400,
                detail=f"Tu plan Pro ya tiene una impresora de {label} configurada. Solo se permite una por tipo.",
            )


class CajaOut(BaseModel):
    id:           str
    nombre:       str
    tipo:         str
    printer_ip:   Optional[str] = None
    printer_port: str = "9100"
    activo:       bool
    model_config = {"from_attributes": True}


class CajaCreate(BaseModel):
    nombre:       str
    tipo:         Literal["caja", "cocina"] = "caja"
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
    _validar_tipo_por_plan(tenant.plan, data.tipo, user.tenant_id, db)

    caja = Caja(
        tenant_id=user.tenant_id,
        nombre=data.nombre,
        tipo=data.tipo,
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
