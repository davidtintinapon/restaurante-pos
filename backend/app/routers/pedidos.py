from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from ..core.database import get_db
from ..deps import get_current_user, require_admin, require_admin_or_cajero, require_staff
from ..models import Pedido, ItemPedido, Mesa, Plato, Usuario
from ..schemas.pedido import (
    PedidoCreate, PedidoAgregarItems, ItemEstadoUpdate, PedidoCerrar, PedidoOut
)
from datetime import datetime, timezone

router = APIRouter(prefix="/pedidos", tags=["pedidos"])


def _pedido_out(pedido: Pedido) -> PedidoOut:
    items = []
    for item in pedido.items:
        items.append({
            "id": item.id,
            "plato_id": item.plato_id,
            "nombre_plato": item.plato.nombre if item.plato else "—",
            "cantidad": item.cantidad,
            "precio_unitario": item.precio_unitario,
            "nota": item.nota,
            "estado": item.estado,
        })
    return PedidoOut(
        id=pedido.id,
        tipo=pedido.tipo or "salon",
        mesa_id=pedido.mesa_id,
        numero_mesa=pedido.mesa.numero if pedido.mesa else None,
        nombre_mesa=pedido.mesa.nombre if pedido.mesa else None,
        nombre_cliente=pedido.nombre_cliente,
        mozo_id=pedido.mozo_id,
        nombre_mozo=pedido.mozo.nombre if pedido.mozo else "—",
        estado=pedido.estado,
        hora_apertura=pedido.hora_apertura,
        hora_cierre=pedido.hora_cierre,
        total=pedido.total or 0,
        metodo_pago=pedido.metodo_pago,
        pagado=pedido.pagado or False,
        nota_general=pedido.nota_general,
        items=items,
    )


def _load_pedido(pedido_id: str, tenant_id: str, db: Session) -> Pedido:
    pedido = db.query(Pedido).options(
        joinedload(Pedido.items).joinedload(ItemPedido.plato),
        joinedload(Pedido.mesa),
        joinedload(Pedido.mozo),
    ).filter(
        Pedido.id == pedido_id,
        Pedido.tenant_id == tenant_id
    ).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return pedido


@router.post("/", response_model=PedidoOut)
def crear_pedido(
    data: PedidoCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_staff),
):
    pedido = Pedido(
        tenant_id=user.tenant_id,
        mozo_id=user.id,
        tipo=data.tipo,
        estado="abierto",
        nota_general=data.nota_general,
    )

    if data.tipo == "salon":
        mesa = db.query(Mesa).filter(
            Mesa.id == data.mesa_id,
            Mesa.tenant_id == user.tenant_id,
            Mesa.activo == True
        ).first()
        if not mesa:
            raise HTTPException(status_code=404, detail="Mesa no encontrada")
        if mesa.estado == "ocupada":
            raise HTTPException(status_code=400, detail="La mesa ya tiene un pedido abierto")
        pedido.mesa_id = data.mesa_id
        mesa.estado = "ocupada"

    elif data.tipo == "llevar":
        pedido.nombre_cliente = data.nombre_cliente

    db.add(pedido)
    db.flush()

    if data.items:
        _agregar_items_al_pedido(pedido, data.items, user.tenant_id, db)

    db.commit()
    db.refresh(pedido)
    return _pedido_out(_load_pedido(pedido.id, user.tenant_id, db))


def _agregar_items_al_pedido(pedido: Pedido, items_data, tenant_id: str, db: Session):
    for item_data in items_data:
        plato = db.query(Plato).filter(
            Plato.id == item_data.plato_id,
            Plato.tenant_id == tenant_id,
            Plato.disponible == True
        ).first()
        if not plato:
            raise HTTPException(status_code=404, detail=f"Plato {item_data.plato_id} no disponible")

        item = ItemPedido(
            pedido_id=pedido.id,
            plato_id=plato.id,
            cantidad=item_data.cantidad,
            precio_unitario=plato.precio,
            nota=item_data.nota,
            estado="pendiente",
        )
        db.add(item)
        pedido.total = (pedido.total or 0) + plato.precio * item_data.cantidad


@router.post("/{pedido_id}/items", response_model=PedidoOut)
def agregar_items(
    pedido_id: str,
    data: PedidoAgregarItems,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_staff),
):
    pedido = _load_pedido(pedido_id, user.tenant_id, db)
    if pedido.estado in ("cerrado", "cancelado"):
        raise HTTPException(status_code=400, detail="No se pueden agregar items a un pedido cerrado")

    _agregar_items_al_pedido(pedido, data.items, user.tenant_id, db)
    db.commit()
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))


@router.patch("/{pedido_id}/items/{item_id}/estado", response_model=PedidoOut)
def cambiar_estado_item(
    pedido_id: str,
    item_id: str,
    data: ItemEstadoUpdate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    ESTADOS_VALIDOS = ["pendiente", "en_preparacion", "listo", "entregado"]
    if data.estado not in ESTADOS_VALIDOS:
        raise HTTPException(status_code=400, detail="Estado de item inválido")

    pedido = _load_pedido(pedido_id, user.tenant_id, db)
    item = next((i for i in pedido.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado en este pedido")

    item.estado = data.estado
    todos_listos = all(i.estado in ("listo", "entregado") for i in pedido.items)
    if todos_listos and pedido.estado == "en_cocina":
        pedido.estado = "listo"

    db.commit()
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))


@router.patch("/{pedido_id}/enviar_cocina", response_model=PedidoOut)
def enviar_a_cocina(
    pedido_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_staff),
):
    pedido = _load_pedido(pedido_id, user.tenant_id, db)
    if pedido.estado != "abierto":
        raise HTTPException(status_code=400, detail="El pedido ya fue enviado a cocina")
    if not pedido.items:
        raise HTTPException(status_code=400, detail="El pedido no tiene items")

    pedido.estado = "en_cocina"
    db.commit()
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))


@router.patch("/{pedido_id}/cerrar", response_model=PedidoOut)
@router.patch("/{pedido_id}/cerrar", response_model=PedidoOut)
def cerrar_pedido(
    pedido_id: str,
    data: PedidoCerrar,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin_or_cajero),
):
    pedido = _load_pedido(pedido_id, user.tenant_id, db)
    if pedido.estado in ("cerrado", "cancelado"):
        raise HTTPException(status_code=400, detail="El pedido ya está cerrado")

    pedido.estado = "cerrado"
    pedido.metodo_pago = data.metodo_pago
    pedido.hora_cierre = datetime.utcnow()

    if data.descuento and data.descuento > 0:
        pedido.total = max(0, (pedido.total or 0) - data.descuento)

    # Descontar stock automáticamente
    for item in pedido.items:
        plato = db.query(Plato).filter(Plato.id == item.plato_id).first()
        if plato and plato.tiene_stock:
            plato.stock = max(0, plato.stock - item.cantidad)
            if plato.stock == 0:
                plato.disponible = False

    if pedido.mesa:
        pedido.mesa.estado = "libre"

    db.commit()
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))


@router.patch("/{pedido_id}/cancelar", response_model=PedidoOut)
def cancelar_pedido(
    pedido_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    pedido = _load_pedido(pedido_id, user.tenant_id, db)
    if pedido.estado in ("cerrado", "cancelado"):
        raise HTTPException(status_code=400, detail="El pedido ya está cerrado/cancelado")

    if pedido.items and user.rol not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="Solo un admin puede cancelar pedidos con items")

    pedido.estado = "cancelado"
    pedido.hora_cierre = datetime.utcnow()
    if pedido.mesa:
        pedido.mesa.estado = "libre"

    db.commit()
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))


@router.get("/mesa/{mesa_id}/activo", response_model=PedidoOut)
def pedido_activo_de_mesa(
    mesa_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    pedido = db.query(Pedido).options(
        joinedload(Pedido.items).joinedload(ItemPedido.plato),
        joinedload(Pedido.mesa),
        joinedload(Pedido.mozo),
    ).filter(
        Pedido.tenant_id == user.tenant_id,
        Pedido.mesa_id == mesa_id,
        Pedido.estado.in_(["abierto", "en_cocina", "listo"]),
    ).first()

    if not pedido:
        raise HTTPException(status_code=404, detail="No hay pedido activo en esta mesa")
    return _pedido_out(pedido)


@router.get("/llevar/activos", response_model=list[PedidoOut])
def listar_pedidos_llevar(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    pedidos = db.query(Pedido).options(
        joinedload(Pedido.items).joinedload(ItemPedido.plato),
        joinedload(Pedido.mesa),
        joinedload(Pedido.mozo),
    ).filter(
        Pedido.tenant_id == user.tenant_id,
        Pedido.tipo == "llevar",
        Pedido.estado.in_(["abierto", "en_cocina", "listo"]),
    ).order_by(Pedido.hora_apertura.asc()).all()

    return [_pedido_out(p) for p in pedidos]


@router.get("/{pedido_id}", response_model=PedidoOut)
def obtener_pedido(
    pedido_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))


@router.get("/", response_model=list[PedidoOut])
def listar_pedidos(
    estado: str | None = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    hoy = datetime.now(timezone.utc).date()

    q = db.query(Pedido).options(
        joinedload(Pedido.items).joinedload(ItemPedido.plato),
        joinedload(Pedido.mesa),
        joinedload(Pedido.mozo),
    ).filter(
        Pedido.tenant_id == user.tenant_id,
        Pedido.hora_apertura >= datetime(hoy.year, hoy.month, hoy.day),
    )

    if estado:
        q = q.filter(Pedido.estado == estado)

    return [_pedido_out(p) for p in q.order_by(Pedido.hora_apertura.desc()).all()]

@router.delete("/{pedido_id}/items/{item_id}", response_model=PedidoOut)
def eliminar_item(
    pedido_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_staff),
):
    pedido = _load_pedido(pedido_id, user.tenant_id, db)
    item = next((i for i in pedido.items if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    if item.estado != "pendiente":
        raise HTTPException(status_code=400, detail="Solo se pueden eliminar items pendientes")

    pedido.total = max(0, (pedido.total or 0) - item.precio_unitario * item.cantidad)
    db.delete(item)
    db.commit()
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))