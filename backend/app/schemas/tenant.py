from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Literal
from datetime import datetime


# Límites por plan — mesas ilimitadas para todos los planes
_PLAN_LIMITS = {
    "basico":  {"max_usuarios": 2,   "max_mesas": 9999},
    "pro":     {"max_usuarios": 5,   "max_mesas": 9999},
    "premium": {"max_usuarios": 999, "max_mesas": 9999},
}


class TenantCreate(BaseModel):
    nombre:         str
    slug:           str
    plan:           Literal["basico", "pro", "premium"] = "basico"
    admin_nombre:   str
    admin_email:    EmailStr
    admin_password: str

    # max_usuarios y max_mesas se derivan del plan automáticamente.
    # Se aceptan opcionalmente para que el superadmin pueda sobreescribir.
    max_usuarios: Optional[int] = None
    max_mesas:    Optional[int] = None

    @field_validator("slug")
    @classmethod
    def slug_valido(cls, v: str) -> str:
        import re
        v = v.strip().lower()
        if not re.match(r'^[a-z0-9-]+$', v):
            raise ValueError("El slug solo puede contener letras minúsculas, números y guiones")
        return v


class TenantUpdate(BaseModel):
    nombre:       Optional[str]                                 = None
    ruc:          Optional[str]                                 = None
    direccion:    Optional[str]                                 = None
    plan:         Optional[Literal["basico", "pro", "premium"]] = None
    activo:       Optional[bool]                                = None
    vence_en:     Optional[datetime]                            = None
    max_usuarios: Optional[int]                                 = None
    max_mesas:    Optional[int]                                 = None


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
