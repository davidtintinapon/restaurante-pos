from sqlalchemy import Column, String, Boolean, Integer, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from ..core.database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id           = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre       = Column(String(150), nullable=False)
    ruc          = Column(String(11),  nullable=True)
    direccion    = Column(String(255), nullable=True)
    slug         = Column(String(80),  nullable=False, unique=True, index=True)
    plan         = Column(String(20),  default="basico")
    activo       = Column(Boolean,     default=True)
    vence_en     = Column(DateTime,    nullable=True)
    max_usuarios = Column(Integer,     default=10)
    max_mesas    = Column(Integer,     default=20)
    creado_en    = Column(DateTime,    default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    usuarios   = relationship("Usuario",   back_populates="tenant", cascade="all, delete-orphan")
    mesas      = relationship("Mesa",      back_populates="tenant", cascade="all, delete-orphan")
    categorias = relationship("Categoria", back_populates="tenant", cascade="all, delete-orphan")
    platos     = relationship("Plato",     back_populates="tenant", cascade="all, delete-orphan")
    pedidos    = relationship("Pedido",    back_populates="tenant", cascade="all, delete-orphan")