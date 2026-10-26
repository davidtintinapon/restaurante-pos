from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UsuarioCreate(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    rol: str  # admin, cajero, mozo, cocinero

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None

class UsuarioOut(BaseModel):
    id: str
    nombre: str
    email: str
    rol: str
    tenant_id: Optional[str] = None
    nombre_restaurante: Optional[str] = None
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    plan: Optional[str] = None
    model_config = {"from_attributes": True}

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UsuarioOut
