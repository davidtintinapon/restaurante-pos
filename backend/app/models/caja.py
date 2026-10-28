from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.sql import func
from ..core.database import Base
import uuid


class Caja(Base):
    __tablename__ = "cajas"

    id           = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id    = Column(String(36), nullable=False, index=True)
    nombre       = Column(String(100), nullable=False)
    printer_ip   = Column(String(50),  nullable=True)
    printer_port = Column(String(10),  default="9100")
    activo       = Column(Boolean,     default=True)
    creado_en    = Column(DateTime,    server_default=func.now())
