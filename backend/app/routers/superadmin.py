from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from ..core.database import get_db
from ..core.security import hash_password
from ..deps import require_superadmin
from ..models import Tenant, Usuario
from ..schemas.tenant import TenantCreate, TenantUpdate, TenantOut
from ..schemas.usuario import UsuarioOut

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
    # Verificar email admin único
    existe = db.query(Usuario).filter(Usuario.email == data.admin_email).first()
    if existe:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    # Crear tenant
    tenant = Tenant(
        nombre=data.nombre,
        slug=data.slug,
        plan=data.plan,
        activo=True,
        max_usuarios=data.max_usuarios,
        max_mesas=data.max_mesas,
        vence_en=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30),
    )
    db.add(tenant)
    db.flush()

    # Crear admin del tenant
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

    for field, value in data.model_dump(exclude_none=True).items():
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
    """Extiende el plan N días desde hoy (o desde vencimiento si aún no venció)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant no encontrado")

    ahora = datetime.now(timezone.utc).replace(tzinfo=None)
    # Si estaba suspendido, renovar siempre desde hoy
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
