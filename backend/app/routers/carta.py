from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..core.database import get_db
from ..deps import get_current_user, require_admin
from ..models import Categoria, Plato, Usuario
from ..schemas.carta import (
    CategoriaCreate, CategoriaUpdate, CategoriaOut,
    PlatoCreate, PlatoUpdate, PlatoOut, CategoriaConPlatos
)

router = APIRouter(prefix="/carta", tags=["carta"])

# ── Categorías ─────────────────────────────────────────────

@router.get("/", response_model=list[CategoriaConPlatos])
def listar_carta(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    """Carta completa con platos agrupados por categoría"""
    categorias = db.query(Categoria).options(
        joinedload(Categoria.platos)
    ).filter(
        Categoria.tenant_id == user.tenant_id,
        Categoria.activo == True
    ).order_by(Categoria.orden).all()

    # Filtrar platos disponibles para mozos/cocina, mostrar todos al admin
    result = []
    for cat in categorias:
        platos = [p for p in cat.platos if p.disponible] if user.rol in ("mozo", "cocinero") else cat.platos
        result.append(CategoriaConPlatos(
            id=cat.id, nombre=cat.nombre, orden=cat.orden, activo=cat.activo,
            platos=[PlatoOut.model_validate(p) for p in platos]
        ))
    return result

@router.post("/categorias", response_model=CategoriaOut)
def crear_categoria(
    data: CategoriaCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    cat = Categoria(tenant_id=user.tenant_id, **data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.patch("/categorias/{cat_id}", response_model=CategoriaOut)
def actualizar_categoria(
    cat_id: str,
    data: CategoriaUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    cat = db.query(Categoria).filter(Categoria.id == cat_id, Categoria.tenant_id == user.tenant_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/categorias/{cat_id}")
def eliminar_categoria(
    cat_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    cat = db.query(Categoria).filter(Categoria.id == cat_id, Categoria.tenant_id == user.tenant_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    cat.activo = False
    db.commit()
    return {"ok": True}

# ── Platos ──────────────────────────────────────────────────

@router.post("/platos", response_model=PlatoOut)
def crear_plato(
    data: PlatoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    # Verificar que la categoría pertenece al tenant
    cat = db.query(Categoria).filter(Categoria.id == data.categoria_id, Categoria.tenant_id == user.tenant_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    plato = Plato(tenant_id=user.tenant_id, **data.model_dump())
    db.add(plato)
    db.commit()
    db.refresh(plato)
    return plato

@router.patch("/platos/{plato_id}", response_model=PlatoOut)
def actualizar_plato(
    plato_id: str,
    data: PlatoUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    plato = db.query(Plato).filter(Plato.id == plato_id, Plato.tenant_id == user.tenant_id).first()
    if not plato:
        raise HTTPException(status_code=404, detail="Plato no encontrado")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(plato, field, value)
    db.commit()
    db.refresh(plato)
    return plato

@router.delete("/platos/{plato_id}")
def eliminar_plato(
    plato_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    plato = db.query(Plato).filter(Plato.id == plato_id, Plato.tenant_id == user.tenant_id).first()
    if not plato:
        raise HTTPException(status_code=404, detail="Plato no encontrado")
    plato.disponible = False
    db.commit()
    return {"ok": True}

@router.get("/stock_bajo")
def platos_stock_bajo(
    umbral: int = 5,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    platos = db.query(Plato).filter(
        Plato.tenant_id == user.tenant_id,
        Plato.tiene_stock == True,
        Plato.disponible == True,
        Plato.stock <= umbral,
    ).order_by(Plato.stock.asc()).all()
    return [{"id": p.id, "nombre": p.nombre, "stock": p.stock} for p in platos]