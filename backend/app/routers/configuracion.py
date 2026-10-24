from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..core.database import get_db
from ..deps import get_current_user, require_admin
from ..models import Usuario
from ..models.configuracion import Configuracion

router = APIRouter(prefix="/configuracion", tags=["configuracion"])


class ConfiguracionOut(BaseModel):
    nombre_restaurante: str
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    moneda: str = "S/."
    pie_ticket: Optional[str] = None
    igv_porcentaje: str = "18"
    mostrar_igv: bool = False
    printer_ip: Optional[str] = None
    printer_port: str = "9100"
    model_config = {"from_attributes": True}


class ConfiguracionUpdate(BaseModel):
    nombre_restaurante: Optional[str] = None
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    moneda: Optional[str] = None
    pie_ticket: Optional[str] = None
    igv_porcentaje: Optional[str] = None
    mostrar_igv: Optional[bool] = None
    printer_ip: Optional[str] = None
    printer_port: Optional[str] = None


def _get_or_create(tenant_id: str, db: Session) -> Configuracion:
    cfg = db.query(Configuracion).filter(Configuracion.tenant_id == tenant_id).first()
    if not cfg:
        cfg = Configuracion(tenant_id=tenant_id)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


@router.get("/", response_model=ConfiguracionOut)
def obtener_configuracion(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return _get_or_create(user.tenant_id, db)


@router.put("/", response_model=ConfiguracionOut)
def actualizar_configuracion(
    data: ConfiguracionUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    cfg = _get_or_create(user.tenant_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(cfg, field, value)
    db.commit()
    db.refresh(cfg)
    return cfg