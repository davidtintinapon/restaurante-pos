from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class TenantCreate(BaseModel):
    nombre:         str
    slug:           str
    plan:           str = "basico"
    max_usuarios:   int = 10
    max_mesas:      int = 20
    admin_nombre:   str
    admin_email:    EmailStr
    admin_password: str


class TenantUpdate(BaseModel):
    nombre:       Optional[str]      = None
    ruc:          Optional[str]      = None
    direccion:    Optional[str]      = None
    plan:         Optional[str]      = None
    activo:       Optional[bool]     = None
    vence_en:     Optional[datetime] = None
    max_usuarios: Optional[int]      = None
    max_mesas:    Optional[int]      = None


class TenantOut(BaseModel):
    id:           str
    nombre:       str
    slug:         str
    ruc:          Optional[str] = None
    direccion:    Optional[str] = None
    plan:         str
    activo:       bool
    vence_en:     Optional[datetime]
    max_usuarios: int
    max_mesas:    int
    creado_en:    datetime

    model_config = {"from_attributes": True}