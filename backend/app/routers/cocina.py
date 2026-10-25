from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from ..core.database import get_db
from ..deps import require_cocina
from ..models import ItemPedido, Pedido, Usuario

router = APIRouter(prefix="/cocina", tags=["cocina"])


@router.get("/pendientes")
def items_pendientes(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_cocina),
):
    """
    Pedidos activos en cocina — disponible en todos los planes.
    La impresión física de ticket de cocina (pro/premium) se maneja
    en el frontend según el plan del tenant.
    """
    items = db.query(ItemPedido).options(
        joinedload(ItemPedido.plato),
        joinedload(ItemPedido.pedido).joinedload(Pedido.mesa),
    ).join(ItemPedido.pedido).filter(
        Pedido.tenant_id == user.tenant_id,
        Pedido.estado.in_(["en_cocina", "listo"]),
        ItemPedido.estado.in_(["pendiente", "en_preparacion"]),
    ).order_by(Pedido.hora_apertura.asc()).all()

    pedidos_dict: dict = {}
    for item in items:
        pid = item.pedido_id
        pedido = item.pedido
        if pid not in pedidos_dict:
            pedidos_dict[pid] = {
                "pedido_id": pid,
                "numero_ticket": pedido.numero_ticket,
                "tipo": pedido.tipo or "salon",
                "nombre_cliente": pedido.nombre_cliente,
                "numero_mesa": pedido.mesa.numero if pedido.mesa else None,
                "nombre_mesa": pedido.mesa.nombre if pedido.mesa else "",
                "creado_en": pedido.hora_apertura,
                "items": [],
            }
        pedidos_dict[pid]["items"].append({
            "id": item.id,
            "nombre_plato": item.plato.nombre if item.plato else "—",
            "cantidad": item.cantidad,
            "nota": item.nota,
            "estado": item.estado,
        })

    return list(pedidos_dict.values())


@router.get("/historial")
def historial_cocina(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_cocina),
):
    """Items ya listos/entregados del día — disponible en todos los planes."""
    from datetime import datetime, timezone
    hoy = datetime.now(timezone.utc).date()

    items = db.query(ItemPedido).options(
        joinedload(ItemPedido.plato),
        joinedload(ItemPedido.pedido).joinedload(Pedido.mesa),
    ).join(ItemPedido.pedido).filter(
        Pedido.tenant_id == user.tenant_id,
        ItemPedido.estado.in_(["listo", "entregado"]),
        Pedido.hora_apertura >= datetime(hoy.year, hoy.month, hoy.day),
    ).order_by(Pedido.hora_apertura.desc()).limit(100).all()

    return [
        {
            "id": item.id,
            "pedido_id": item.pedido_id,
            "numero_mesa": item.pedido.mesa.numero if item.pedido and item.pedido.mesa else "—",
            "nombre_plato": item.plato.nombre if item.plato else "—",
            "cantidad": item.cantidad,
            "nota": item.nota,
            "estado": item.estado,
        }
        for item in items
    ]
