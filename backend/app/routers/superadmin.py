from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from ..core.database import get_db
from ..core.security import hash_password
from ..deps import require_superadmin
from ..models import Tenant, Usuario
from ..schemas.tenant import TenantCreate, TenantUpdate, TenantOut, _PLAN_LIMITS
from ..schemas.usuario import UsuarioOut
from pydantic import BaseModel

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


@router.get("/tenants", response_model=list[TenantOut])
def listar_tenants(
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    return db.query(Tenant).order_by(Tenant.nombre).all()


@router.post("/tenants", response_model=TenantOut)
def crear_tenant(
    data: TenantCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    """Crea un tenant nuevo con su usuario admin."""
    existe = db.query(Usuario).filter(Usuario.email == data.admin_email).first()
    if existe:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    limites = _PLAN_LIMITS.get(data.plan, _PLAN_LIMITS["basico"])
    max_usuarios = data.max_usuarios if data.max_usuarios is not None else limites["max_usuarios"]
    max_mesas    = data.max_mesas    if data.max_mesas    is not None else limites["max_mesas"]

    tenant = Tenant(
        nombre=data.nombre,
        slug=data.slug,
        plan=data.plan,
        activo=True,
        max_usuarios=max_usuarios,
        max_mesas=max_mesas,
        vence_en=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30),
    )
    db.add(tenant)
    db.flush()

    admin = Usuario(
        tenant_id=tenant.id,
        nombre=data.admin_nombre,
        email=data.admin_email,
        password_hash=hash_password(data.admin_password),
        rol="admin",
    )
    db.add(admin)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.patch("/tenants/{tenant_id}", response_model=TenantOut)
def actualizar_tenant(
    tenant_id: str,
    data: TenantUpdate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    update_data = data.model_dump(exclude_none=True)

    # Si cambia el plan, actualizar max_usuarios automáticamente
    if "plan" in update_data:
        limites = _PLAN_LIMITS.get(update_data["plan"], _PLAN_LIMITS["basico"])
        update_data.setdefault("max_usuarios", limites["max_usuarios"])
        update_data.setdefault("max_mesas", limites["max_mesas"])
        # Reactivar tenant si estaba suspendido y se le asigna un plan
        if not tenant.activo:
            update_data["activo"] = True

    for field, value in update_data.items():
        setattr(tenant, field, value)
    db.commit()
    db.refresh(tenant)
    return tenant


@router.patch("/tenants/{tenant_id}/renovar")
def renovar_tenant(
    tenant_id: str,
    dias: int = 30,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    """Extiende el plan N dias desde hoy (o desde vencimiento si aun no vencio)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    if not tenant.activo:
        base = ahora
    else:
        base = tenant.vence_en if tenant.vence_en and tenant.vence_en > ahora else ahora
    tenant.vence_en = base + timedelta(days=dias)
    tenant.activo = True
    db.commit()
    return {"ok": True, "vence_en": tenant.vence_en}


@router.patch("/tenants/{tenant_id}/suspender")
def suspender_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")
    tenant.activo = False
    db.commit()
    return {"ok": True}


@router.get("/tenants/{tenant_id}/usuarios", response_model=list[UsuarioOut])
def usuarios_de_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    return db.query(Usuario).filter(
        Usuario.tenant_id == tenant_id,
        Usuario.activo == True,
    ).order_by(Usuario.nombre).all()


@router.delete("/tenants/{tenant_id}")
def eliminar_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    """Soft delete: desactiva tenant y todos sus usuarios."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    tenant.activo = False
    db.query(Usuario).filter(Usuario.tenant_id == tenant_id).update({"activo": False})
    db.commit()
    return {"ok": True}


# -- Gestion de usuarios por superadmin -------------------------------------

class SetRolBody(BaseModel):
    rol: str  # "admin" | "cajero" | "cocina"


@router.get("/usuarios/buscar")
def buscar_usuario_por_email(
    email: str,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    """Busca un usuario por email (para obtener su ID)."""
    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "email": usuario.email,
        "rol": usuario.rol,
        "tenant_id": usuario.tenant_id,
        "activo": usuario.activo,
    }


@router.patch("/usuarios/{usuario_id}/rol", response_model=UsuarioOut)
def forzar_rol_usuario(
    usuario_id: str,
    body: SetRolBody,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    """Superadmin puede forzar cualquier rol en cualquier usuario."""
    roles_validos = {"admin", "cajero", "cocina"}
    if body.rol not in roles_validos:
        raise HTTPException(status_code=400, detail=f"Rol invalido. Opciones: {roles_validos}")

    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    usuario.rol = body.rol
    db.commit()
    db.refresh(usuario)
    return usuario
