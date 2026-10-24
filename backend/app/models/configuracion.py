from sqlalchemy import Column, String, Boolean
from ..core.database import Base
import uuid

class Configuracion(Base):
    __tablename__ = "configuraciones"

    id               = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id        = Column(String(36), nullable=False, unique=True, index=True)

    nombre_restaurante = Column(String(150), default="Mi Restaurante")
    ruc                = Column(String(20),  nullable=True)
    direccion          = Column(String(200), nullable=True)
    telefono           = Column(String(30),  nullable=True)
    email              = Column(String(100), nullable=True)
    moneda             = Column(String(10),  default="S/.")
    pie_ticket         = Column(String(200), nullable=True)
    igv_porcentaje     = Column(String(5),   default="18")
    mostrar_igv        = Column(Boolean,     default=False)
    printer_ip         = Column(String(50),  nullable=True)
    printer_port       = Column(String(10),  default="9100")