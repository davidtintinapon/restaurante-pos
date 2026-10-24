from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, condecimal
from typing import Optional
from ..core.database import get_db
from ..deps import get_current_user, require_admin, require_admin_or_cajero
from ..models import Usuario
from ..models.gasto import GastoCaja, CATEGORIAS_GASTO

router = APIRouter(prefix="/gastos", tags=["gastos"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class GastoCreate(BaseModel):
    descripcion: str
    monto: float
    categoria: str = "otros"


class GastoOut(BaseModel):
    id: str
    descripcion: str
    monto: float
    categoria: str
    registrado_por: str
    hora: str

    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_hora(dt: datetime) -> str:
    if not dt:
        return ""
    utc = dt.replace(tzinfo=timezone.utc)
    local = utc + timedelta(hours=-5)
    return local.strftime("%d/%m/%Y %H:%M")


def _rango_dia(fecha_str: Optional[str] = None):
    """Devuelve (ini_utc, fin_utc) para el día local dado (o hoy)."""
    if fecha_str:
        dia = datetime.strptime(fecha_str, "%Y-%m-%d").date()
    else:
        dia = (datetime.now(timezone.utc) + timedelta(hours=-5)).date()
    ini_utc = datetime(dia.year, dia.month, dia.day) + timedelta(hours=5)
    fin_utc = ini_utc + timedelta(days=1)
    return ini_utc, fin_utc


# ── Rutas ─────────────────────────────────────────────────────────────────────

@router.get("/categorias")
def listar_categorias():
    return CATEGORIAS_GASTO


@router.post("/", response_model=GastoOut)
def registrar_gasto(
    data: GastoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin_or_cajero),
):
    if data.categoria not in CATEGORIAS_GASTO:
        raise HTTPException(status_code=400, detail=f"Categoría inválida. Opciones: {CATEGORIAS_GASTO}")
    if data.monto <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")

    gasto = GastoCaja(
        tenant_id=user.tenant_id,
        descripcion=data.descripcion.strip(),
        monto=data.monto,
        categoria=data.categoria,
        registrado_por_id=user.id,
    )
    db.add(gasto)
    db.commit()
    db.refresh(gasto)

    return GastoOut(
        id=gasto.id,
        descripcion=gasto.descripcion,
        monto=float(gasto.monto),
        categoria=gasto.categoria,
        registrado_por=gasto.registrado_por.nombre,
        hora=_fmt_hora(gasto.hora),
    )


@router.get("/", response_model=list[GastoOut])
def listar_gastos(
    fecha: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin_or_cajero),
):
    ini_utc, fin_utc = _rango_dia(fecha)

    gastos = db.query(GastoCaja).filter(
        GastoCaja.tenant_id == user.tenant_id,
        GastoCaja.hora >= ini_utc,
        GastoCaja.hora < fin_utc,
    ).order_by(GastoCaja.hora.desc()).all()

    return [
        GastoOut(
            id=g.id,
            descripcion=g.descripcion,
            monto=float(g.monto),
            categoria=g.categoria,
            registrado_por=g.registrado_por.nombre,
            hora=_fmt_hora(g.hora),
        )
        for g in gastos
    ]


@router.delete("/{gasto_id}")
def eliminar_gasto(
    gasto_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    gasto = db.query(GastoCaja).filter(
        GastoCaja.id == gasto_id,
        GastoCaja.tenant_id == user.tenant_id,
    ).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    db.delete(gasto)
    db.commit()
    return {"ok": True}