from pydantic import BaseModel, model_validator
from typing import Optional, Literal
from decimal import Decimal
from datetime import datetime

class ItemPedidoCreate(BaseModel):
    plato_id: str
    cantidad: int = 1
    nota: Optional[str] = None

class ItemPedidoOut(BaseModel):
    id: str
    plato_id: str
    nombre_plato: str
    cantidad: int
    precio_unitario: Decimal
    estado: str
    nota: Optional[str]
    model_config = {"from_attributes": True}

class PedidoCreate(BaseModel):
    tipo: Literal["salon", "llevar"] = "salon"
    mesa_id: Optional[str] = None          # requerido si tipo=salon
    nombre_cliente: Optional[str] = None   # requerido si tipo=llevar
    items: list[ItemPedidoCreate]
    nota_general: Optional[str] = None

    @model_validator(mode="after")
    def validar_tipo(self):
        if self.tipo == "salon" and not self.mesa_id:
            raise ValueError("mesa_id es requerido para pedidos de salón")
        if self.tipo == "llevar" and not self.nombre_cliente:
            raise ValueError("nombre_cliente es requerido para pedidos LLEVAR")
        return self

class PedidoAgregarItems(BaseModel):
    items: list[ItemPedidoCreate]

class ItemEstadoUpdate(BaseModel):
    estado: str

class PedidoCerrar(BaseModel):
    metodo_pago: Literal["efectivo", "yape", "plin", "tarjeta", "transferencia"]
    descuento: Optional[float] = None

class PedidoOut(BaseModel):
    id: str
    tipo: str = "salon"
    mesa_id: Optional[str] = None
    numero_mesa: Optional[int] = None
    nombre_mesa: Optional[str] = None
    nombre_cliente: Optional[str] = None
    mozo_id: str
    nombre_mozo: str
    estado: str
    hora_apertura: datetime
    hora_cierre: Optional[datetime] = None
    total: Decimal
    metodo_pago: Optional[str] = None
    pagado: bool
    nota_general: Optional[str] = None
    items: list[ItemPedidoOut] = []
    model_config = {"from_attributes": True}