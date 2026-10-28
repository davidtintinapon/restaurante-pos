from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..deps import get_current_user, require_admin
from ..models import Zona, Usuario
from ..schemas.zona import ZonaCreate, ZonaUpdate, ZonaOut

router = APIRouter(prefix="/zonas", tags=["zonas"])

@router.get("/", response_model=list[ZonaOut])
def listar_zonas(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return db.query(Zona).filter(
        Zona.tenant_id == user.tenant_id,
        Zona.activo == True
    ).order_by(Zona.orden, Zona.nombre).all()

@router.post("/", response_model=ZonaOut)
def crear_zona(
    data: ZonaCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    existe = db.query(Zona).filter(
        Zona.tenant_id == user.tenant_id,
        Zona.nombre == data.nombre,
        Zona.activo == True
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ya existe una zona con ese nombre")

    zona = Zona(tenant_id=user.tenant_id, **data.model_dump())
    db.add(zona)
    db.commit()
    db.refresh(zona)
    return zona

@router.patch("/{zona_id}", response_model=ZonaOut)
def actualizar_zona(
    zona_id: str,
    data: ZonaUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    zona = db.query(Zona).filter(Zona.id == zona_id, Zona.tenant_id == user.tenant_id).first()
    if not zona:
        raise HTTPException(status_code=404, detail="Zona no encontrada")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(zona, field, value)
    db.commit()
    db.refresh(zona)
    return zona

@router.delete("/{zona_id}")
def eliminar_zona(
    zona_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    zona = db.query(Zona).filter(Zona.id == zona_id, Zona.tenant_id == user.tenant_id).first()
    if not zona:
        raise HTTPException(status_code=404, detail="Zona no encontrada")

    # Verificar que no tenga mesas activas
    from ..models import Mesa
    mesas_activas = db.query(Mesa).filter(
        Mesa.tenant_id == user.tenant_id,
        Mesa.zona == zona.nombre,
        Mesa.activo == True
    ).count()
    if mesas_activas > 0:
        raise HTTPException(status_code=400, detail=f"No puedes eliminar una zona con {mesas_activas} mesa(s) activa(s)")

    zona.activo = False
    db.commit()
    return {"ok": True}
