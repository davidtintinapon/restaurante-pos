from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..core.database import Base

class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    mesa_id = Column(String(36), ForeignKey("mesas.id"), nullable=True)   # nullable para LLEVAR
    mozo_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    tipo = Column(String(20), default="salon")                             # salon, llevar
    nombre_cliente = Column(String(100), nullable=True)                    # solo para LLEVAR
    estado = Column(String(20), default="abierto")
    hora_apertura = Column(DateTime, default=datetime.utcnow)
    hora_cierre = Column(DateTime, nullable=True)
    total = Column(Numeric(10, 2), default=0)
    metodo_pago = Column(String(30), nullable=True)
    pagado = Column(Boolean, default=False)
    nota_general = Column(Text, nullable=True)

    tenant = relationship("Tenant", back_populates="pedidos")
    mesa = relationship("Mesa", back_populates="pedidos")
    mozo = relationship("Usuario", back_populates="pedidos", foreign_keys=[mozo_id])
    items = relationship("ItemPedido", back_populates="pedido", cascade="all, delete-orphan")


class ItemPedido(Base):
    __tablename__ = "items_pedido"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pedido_id = Column(String(36), ForeignKey("pedidos.id"), nullable=False)
    plato_id = Column(String(36), ForeignKey("platos.id"), nullable=False)
    cantidad = Column(Integer, default=1)
    precio_unitario = Column(Numeric(10, 2), nullable=False)
    estado = Column(String(20), default="pendiente")
    nota = Column(String(200), nullable=True)

    pedido = relationship("Pedido", back_populates="items")
    plato = relationship("Plato", back_populates="items")