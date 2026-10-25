from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.security import hash_password
from ..deps import get_current_user, require_admin
from ..models import Usuario, Tenant
from ..schemas.usuario import UsuarioCreate, UsuarioUpdate, UsuarioOut

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

@router.get("/me", response_model=UsuarioOut)
def mi_perfil(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return user

@router.get("/", response_model=list[UsuarioOut])
def listar_usuarios(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    return db.query(Usuario).filter(
        Usuario.tenant_id == user.tenant_id,
        Usuario.activo == True,
        Usuario.rol != "superadmin",
    ).order_by(Usuario.nombre).all()


@router.post("/", response_model=UsuarioOut)
def crear_usuario(
    data: UsuarioCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    # Verificar límite del plan
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    total_usuarios = db.query(Usuario).filter(
        Usuario.tenant_id == user.tenant_id,
        Usuario.activo == True,
        Usuario.rol != "superadmin",
    ).count()

    if tenant and tenant.max_usuarios and total_usuarios >= tenant.max_usuarios:
        raise HTTPException(
            status_code=403,
            detail=f"Límite de usuarios alcanzado ({tenant.max_usuarios}). Mejora tu plan para agregar más usuarios."
        )

    # Validar roles permitidos según plan
    _ROLES_BASICO = {"admin", "cajero"}
    _ROLES_TODOS  = {"admin", "cajero", "mozo", "cocinero"}

    if tenant and tenant.plan == "basico" and data.rol not in _ROLES_BASICO:
        raise HTTPException(
            status_code=403,
            detail="El plan Básico solo permite los roles admin y cajero. Mejora tu plan para agregar mozos o cocineros."
        )
    if data.rol not in _ROLES_TODOS:
        raise HTTPException(
            status_code=400,
            detail=f"Rol '{data.rol}' no válido. Roles permitidos: admin, cajero, mozo, cocinero."
        )

    # Email único
    existe = db.query(Usuario).filter(Usuario.email == data.email).first()
    if existe:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    nuevo = Usuario(
        tenant_id=user.tenant_id,
        nombre=data.nombre,
        email=data.email,
        password_hash=hash_password(data.password),
        rol=data.rol,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.patch("/{usuario_id}", response_model=UsuarioOut)
def actualizar_usuario(
    usuario_id: str,
    data: UsuarioUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    target = db.query(Usuario).filter(
        Usuario.id == usuario_id,
        Usuario.tenant_id == user.tenant_id,
        Usuario.rol != "superadmin",
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if data.nombre is not None:
        target.nombre = data.nombre
    if data.email is not None:
        # Verificar email único
        existe = db.query(Usuario).filter(
            Usuario.email == data.email,
            Usuario.id != usuario_id
        ).first()
        if existe:
            raise HTTPException(status_code=400, detail="El email ya está en uso")
        target.email = data.email
    if data.rol is not None:
        target.rol = data.rol
    if data.password is not None:
        target.password_hash = hash_password(data.password)

    db.commit()
    db.refresh(target)
    return target


@router.delete("/{usuario_id}")
def eliminar_usuario(
    usuario_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    # No puede eliminarse a sí mismo
    if usuario_id == user.id:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")

    target = db.query(Usuario).filter(
        Usuario.id == usuario_id,
        Usuario.tenant_id == user.tenant_id,
        Usuario.rol != "superadmin",
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    target.activo = False
    db.commit()
    return {"ok": True}
