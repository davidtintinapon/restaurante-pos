from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.security import verify_password, create_access_token
from ..models import Usuario, Tenant
from ..schemas.usuario import LoginRequest, TokenResponse, UsuarioOut

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(
        Usuario.email == data.email,
        Usuario.activo == True
    ).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    user_out = UsuarioOut(
        id=user.id,
        nombre=user.nombre,
        email=user.email,
        rol=user.rol,
        tenant_id=user.tenant_id,
        nombre_restaurante=tenant.nombre if tenant else "Restaurante",
        ruc=tenant.ruc if tenant else None,
        direccion=tenant.direccion if tenant else None,
    )

    token = create_access_token({"sub": user.id, "tenant_id": user.tenant_id, "rol": user.rol})
    return TokenResponse(access_token=token, user=user_out)