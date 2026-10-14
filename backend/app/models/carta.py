from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..core.database import Base

class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    nombre = Column(String(80), nullable=False)
    orden = Column(Integer, default=0)
    activo = Column(Boolean, default=True)

    tenant = relationship("Tenant", back_populates="categorias")
    platos = relationship("Plato", back_populates="categoria", cascade="all, delete-orphan")


class Plato(Base):
    __tablename__ = "platos"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    categoria_id = Column(String(36), ForeignKey("categorias.id"), nullable=False)
    nombre = Column(String(120), nullable=False)
    descripcion = Column(Text, nullable=True)
    precio = Column(Numeric(10, 2), nullable=False)
    disponible = Column(Boolean, default=True)
    creado_en = Column(DateTime, default=datetime.utcnow)
    tiene_stock = Column(Boolean, default=False)
    stock = Column(Integer, default=0)

    tenant = relationship("Tenant", back_populates="platos")
    categoria = relationship("Categoria", back_populates="platos")
    items = relationship("ItemPedido", back_populates="plato")
