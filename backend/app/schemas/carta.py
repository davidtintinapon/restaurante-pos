from pydantic import BaseModel
from typing import Optional
from decimal import Decimal

class CategoriaCreate(BaseModel):
    nombre: str
    orden: int = 0

class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = None
    orden: Optional[int] = None
    activo: Optional[bool] = None

class CategoriaOut(BaseModel):
    id: str
    nombre: str
    orden: int
    activo: bool

    model_config = {"from_attributes": True}

class PlatoCreate(BaseModel):
    categoria_id: str
    nombre: str
    descripcion: Optional[str] = None
    precio: Decimal
    disponible: bool = True
    tiene_stock: bool = False
    stock: int = 0

class PlatoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    precio: Optional[Decimal] = None
    disponible: Optional[bool] = None
    categoria_id: Optional[str] = None
    tiene_stock: Optional[bool] = None
    stock: Optional[int] = None

class PlatoOut(BaseModel):
    id: str
    categoria_id: str
    nombre: str
    descripcion: Optional[str]
    precio: Decimal
    disponible: bool
    tiene_stock: bool = False
    stock: int = 0

    model_config = {"from_attributes": True}

class CategoriaConPlatos(BaseModel):
    id: str
    nombre: str
    orden: int
    activo: bool
    platos: list[PlatoOut] = []

    model_config = {"from_attributes": True}