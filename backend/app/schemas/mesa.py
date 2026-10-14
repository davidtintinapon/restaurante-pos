from pydantic import BaseModel
from typing import Optional

class MesaCreate(BaseModel):
    numero: int
    nombre: Optional[str] = None
    capacidad: int = 4
    zona: str = "salon"

class MesaUpdate(BaseModel):
    nombre: Optional[str] = None
    capacidad: Optional[int] = None
    zona: Optional[str] = None
    activo: Optional[bool] = None

class MesaEstadoUpdate(BaseModel):
    estado: str  # libre, ocupada, reservada, cuenta_pedida

class MesaOut(BaseModel):
    id: str
    numero: int
    nombre: Optional[str]
    capacidad: int
    zona: str
    estado: str
    activo: bool

    model_config = {"from_attributes": True}
