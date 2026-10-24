from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from ..core.database import Base


CATEGORIAS_GASTO = ["insumos", "servicios", "personal", "mantenimiento", "otros"]


class GastoCaja(Base):
    __tablename__ = "gastos_caja"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String(36), ForeignKey("tenants.id"), nullable=False)
    descripcion = Column(String(200), nullable=False)
    monto = Column(Numeric(10, 2), nullable=False)
    categoria = Column(String(30), nullable=False, default="otros")
    registrado_por_id = Column(String(36), ForeignKey("usuarios.id"), nullable=False)
    hora = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), nullable=False)

    tenant = relationship("Tenant")
    registrado_por = relationship("Usuario", foreign_keys=[registrado_por_id])