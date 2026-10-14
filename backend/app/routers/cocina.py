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
    Vista de cocina: todos los items en estado pendiente o en_preparacion
    de pedidos activos del tenant, agrupados por pedido.
    Polling cada 10 segundos desde el frontend.
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
        if pid not in pedidos_dict:
            pedidos_dict[pid] = {
                "pedido_id": pid,
                "tipo": item.pedido.tipo or "salon",
                "numero_mesa": item.pedido.mesa.numero if item.pedido.mesa else "—",
                "nombre_mesa": item.pedido.mesa.nombre if item.pedido.mesa else "",
                "nombre_cliente": item.pedido.nombre_cliente,
                "creado_en": item.pedido.hora_apertura,
                "nota_general": item.pedido.nota_general,
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
    """Items ya listos/entregados del día — para referencia."""
    from datetime import datetime, timezone, date
    hoy = datetime.now(timezone.utc).date()

    items = db.query(ItemPedido).options(
        joinedload(ItemPedido.plato),
        joinedload(ItemPedido.pedido).joinedload(Pedido.mesa),
    ).join(ItemPedido.pedido).filter(
        ItemPedido.tenant_id == user.tenant_id,
        ItemPedido.estado.in_(["listo", "entregado"]),
        ItemPedido.creado_en >= datetime(hoy.year, hoy.month, hoy.day, tzinfo=timezone.utc),
    ).order_by(ItemPedido.creado_en.desc()).limit(100).all()

    return [
        {
            "id": item.id,
            "pedido_id": item.pedido_id,
            "numero_mesa": item.pedido.mesa.numero if item.pedido and item.pedido.mesa else "—",
            "nombre_plato": item.plato.nombre if item.plato else "—",
            "cantidad": item.cantidad,
            "nota": item.nota,
            "estado": item.estado,
            "creado_en": item.creado_en,
        }
        for item in items
    ]
