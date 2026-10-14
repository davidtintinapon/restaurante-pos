from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError
from .core.database import get_db
from .core.security import decode_token
from .models import Usuario, Tenant

bearer = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    token = credentials.credentials
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")

    user = db.query(Usuario).filter(Usuario.id == user_id, Usuario.activo == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    # Verificar que el tenant esté activo (excepto superadmin)
    if user.rol != "superadmin" and user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if not tenant or not tenant.activo:
            raise HTTPException(status_code=403, detail="Tu cuenta está suspendida. Contacta al administrador.")

    return user

def require_superadmin(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol != "superadmin":
        raise HTTPException(status_code=403, detail="Acceso solo para superadmin")
    return user

def require_admin(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Acceso solo para administradores")
    return user

def require_admin_or_cajero(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol not in ("admin", "cajero"):
        raise HTTPException(status_code=403, detail="Acceso solo para admin o cajero")
    return user

def require_staff(user: Usuario = Depends(get_current_user)) -> Usuario:
    """Admin, cajero o mozo — cualquiera que opera el sistema"""
    if user.rol not in ("admin", "cajero", "mozo"):
        raise HTTPException(status_code=403, detail="Acceso no autorizado")
    return user

def require_cocina(user: Usuario = Depends(get_current_user)) -> Usuario:
    """Admin o cocinero"""
    if user.rol not in ("admin", "cocinero"):
        raise HTTPException(status_code=403, detail="Acceso solo para cocina")
    return user
