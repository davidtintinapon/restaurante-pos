from pydantic import BaseModel
from typing import Optional

class ZonaCreate(BaseModel):
    nombre: str
    orden: int = 0

class ZonaUpdate(BaseModel):
    nombre: Optional[str] = None
    orden: Optional[int] = None

class ZonaOut(BaseModel):
    id: str
    nombre: str
    orden: int
    activo: bool

    model_config = {"from_attributes": True}
