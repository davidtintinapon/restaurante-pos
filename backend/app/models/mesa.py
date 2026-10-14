from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..core.database import Base

class Mesa(Base):
    __tablename__ = "mesas"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    numero = Column(Integer, nullable=False)
    nombre = Column(String(50), nullable=True)   # "Mesa VIP", "Terraza 1", etc.
    capacidad = Column(Integer, default=4)
    zona = Column(String(50), default="salon")   # salon, terraza, barra, privado
    estado = Column(String(20), default="libre") # libre, ocupada, reservada, cuenta_pedida
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="mesas")
    pedidos = relationship("Pedido", back_populates="mesa")
