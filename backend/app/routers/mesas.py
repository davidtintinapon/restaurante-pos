from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..deps import get_current_user, require_admin
from ..models import Mesa, Usuario
from ..schemas.mesa import MesaCreate, MesaUpdate, MesaEstadoUpdate, MesaOut

router = APIRouter(prefix="/mesas", tags=["mesas"])

@router.get("/", response_model=list[MesaOut])
def listar_mesas(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return db.query(Mesa).filter(
        Mesa.tenant_id == user.tenant_id,
        Mesa.activo == True
    ).order_by(Mesa.zona, Mesa.numero).all()

@router.post("/", response_model=MesaOut)
def crear_mesa(
    data: MesaCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    # Verificar que el número no esté duplicado
    existe = db.query(Mesa).filter(
        Mesa.tenant_id == user.tenant_id,
        Mesa.numero == data.numero,
        Mesa.activo == True
    ).first()
    if existe:
        raise HTTPException(status_code=400, detail=f"Ya existe la mesa {data.numero}")

    mesa = Mesa(tenant_id=user.tenant_id, **data.model_dump())
    db.add(mesa)
    db.commit()
    db.refresh(mesa)
    return mesa

@router.patch("/{mesa_id}", response_model=MesaOut)
def actualizar_mesa(
    mesa_id: str,
    data: MesaUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    mesa = db.query(Mesa).filter(Mesa.id == mesa_id, Mesa.tenant_id == user.tenant_id).first()
    if not mesa:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(mesa, field, value)
    db.commit()
    db.refresh(mesa)
    return mesa

@router.patch("/{mesa_id}/estado", response_model=MesaOut)
def cambiar_estado_mesa(
    mesa_id: str,
    data: MesaEstadoUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    ESTADOS_VALIDOS = ["libre", "ocupada", "reservada", "cuenta_pedida"]
    if data.estado not in ESTADOS_VALIDOS:
        raise HTTPException(status_code=400, detail="Estado inválido")

    mesa = db.query(Mesa).filter(Mesa.id == mesa_id, Mesa.tenant_id == user.tenant_id).first()
    if not mesa:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")

    mesa.estado = data.estado
    db.commit()
    db.refresh(mesa)
    return mesa

@router.delete("/{mesa_id}")
def eliminar_mesa(
    mesa_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    mesa = db.query(Mesa).filter(Mesa.id == mesa_id, Mesa.tenant_id == user.tenant_id).first()
    if not mesa:
        raise HTTPException(status_code=404, detail="Mesa no encontrada")
    mesa.activo = False
    db.commit()
    return {"ok": True}
