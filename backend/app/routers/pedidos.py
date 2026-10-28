from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func, select
from sqlalchemy.exc import OperationalError
from ..core.database import get_db
from ..deps import get_current_user, require_admin, require_admin_or_cajero, require_staff
from ..models import Pedido, ItemPedido, Mesa, Plato, Usuario
from ..schemas.pedido import (
    PedidoCreate, PedidoAgregarItems, ItemEstadoUpdate, PedidoCerrar, PedidoOut,
    PedidoDeliveryCreate,
)
from ..models.configuracion import Configuracion
from ..utils.printer import imprimir_ticket_cocina
from datetime import datetime, timezone, timedelta
import json

router = APIRouter(prefix="/pedidos", tags=["pedidos"])

# Zona horaria de Perú (UTC-5)
TZ_LIMA = timezone(timedelta(hours=-5))


def _ahora_lima() -> datetime:
    """Retorna la fecha/hora actual en hora Lima (UTC-5)."""
    return datetime.now(TZ_LIMA)


def _inicio_dia_lima_en_utc() -> datetime:
    """
    Retorna el inicio del día actual (00:00:00) en hora Lima,
    expresado como datetime naive en UTC para comparar con hora_apertura en BD.

    Ejemplo: si son las 19:30 Lima (00:30 UTC del día siguiente),
    retorna 2024-10-15 05:00:00 (= medianoche Lima del 15/10 en UTC).
    """
    ahora_lima = _ahora_lima()
    inicio_dia_lima = ahora_lima.replace(hour=0, minute=0, second=0, microsecond=0)
    # Convertir a UTC y quitar tzinfo para comparar con columnas naive en BD
    inicio_dia_utc = inicio_dia_lima.astimezone(timezone.utc).replace(tzinfo=None)
    return inicio_dia_utc


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
        zona_mesa=pedido.mesa.zona if pedido.mesa else None,
        nombre_cliente=pedido.nombre_cliente,
        telefono_delivery=pedido.telefono_delivery,
        direccion_delivery=pedido.direccion_delivery,
        mozo_id=pedido.mozo_id,
        nombre_mozo=pedido.mozo.nombre if pedido.mozo else "—",
        estado=pedido.estado,
        hora_apertura=pedido.hora_apertura,
        hora_cierre=pedido.hora_cierre,
        total=pedido.total or 0,
        metodo_pago=pedido.metodo_pago,
        pagado=pedido.pagado or False,
        nota_general=pedido.nota_general,
        numero_ticket=pedido.numero_ticket,
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


def _siguiente_numero_ticket(tenant_id: str, db: Session) -> int:
    """
    Calcula el siguiente número correlativo del día para el tenant.
    Usa hora Lima (UTC-5) para determinar el inicio del día,
    evitando que el contador se reinicie a las 19:00 hora Perú.

    Usa SELECT FOR UPDATE (con fallback para SQLite) para evitar
    que dos cajeros obtengan el mismo número de ticket simultáneamente.
    """
    inicio_dia = _inicio_dia_lima_en_utc()

    # MAX() no admite FOR UPDATE en PostgreSQL — leemos el máximo del día
    ultimo = db.query(func.max(Pedido.numero_ticket)).filter(
        Pedido.tenant_id == tenant_id,
        Pedido.hora_apertura >= inicio_dia,
        Pedido.numero_ticket.isnot(None),
    ).scalar()

    return (ultimo or 0) + 1


def _serializar_metodo_pago(pagos: list) -> str:
    """
    Convierte la lista de pagos a string para guardar en BD.
    - Si es un solo pago: guarda solo el string del método (retrocompatible)
    - Si es pago mixto: guarda JSON → '{"efectivo":20.0,"yape":20.0}'
    """
    pagos_validos = [p for p in pagos if p.get("monto", 0) > 0]
    if not pagos_validos:
        return "efectivo"
    if len(pagos_validos) == 1:
        return pagos_validos[0]["metodo"]
    # Pago mixto: dict de metodo→monto
    return json.dumps({p["metodo"]: round(p["monto"], 2) for p in pagos_validos}, ensure_ascii=False)


# ─── RUTAS FIJAS (deben ir ANTES de /{pedido_id}) ────────────────────────────

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


@router.post("/delivery", response_model=PedidoOut)
def crear_delivery(
    data: PedidoDeliveryCreate,
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_staff),
):
    if not data.telefono or not data.direccion:
        raise HTTPException(status_code=400, detail="Teléfono y dirección son obligatorios")

    pedido = Pedido(
        tenant_id=user.tenant_id,
        mozo_id=user.id,
        tipo="delivery",
        estado="abierto",
        nombre_cliente=data.nombre_cliente,
        telefono_delivery=data.telefono,
        direccion_delivery=data.direccion,
    )
    db.add(pedido)
    db.flush()

    if data.items:
        _agregar_items_al_pedido(pedido, data.items, user.tenant_id, db)

    db.commit()
    return _pedido_out(_load_pedido(pedido.id, user.tenant_id, db))


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


@router.get("/delivery/activos", response_model=list[PedidoOut])
def listar_deliveries_activos(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    pedidos = db.query(Pedido).options(
        joinedload(Pedido.items).joinedload(ItemPedido.plato),
        joinedload(Pedido.mesa),
        joinedload(Pedido.mozo),
    ).filter(
        Pedido.tenant_id == user.tenant_id,
        Pedido.tipo == "delivery",
        Pedido.estado.in_(["abierto", "en_cocina", "listo"]),
    ).order_by(Pedido.hora_apertura.asc()).all()

    return [_pedido_out(p) for p in pedidos]


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


@router.get("/", response_model=list[PedidoOut])
def listar_pedidos(
    estado: str | None = None,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    # Usar hora Lima para el inicio del día (evita que la lista se vacíe a las 19:00)
    inicio_dia = _inicio_dia_lima_en_utc()

    q = db.query(Pedido).options(
        joinedload(Pedido.items).joinedload(ItemPedido.plato),
        joinedload(Pedido.mesa),
        joinedload(Pedido.mozo),
    ).filter(
        Pedido.tenant_id == user.tenant_id,
        Pedido.hora_apertura >= inicio_dia,
    )

    if estado:
        q = q.filter(Pedido.estado == estado)

    return [_pedido_out(p) for p in q.order_by(Pedido.hora_apertura.desc()).all()]


# ─── RUTAS CON {pedido_id} (deben ir AL FINAL) ───────────────────────────────

@router.get("/{pedido_id}", response_model=PedidoOut)
def obtener_pedido(
    pedido_id: str,
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))


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

    # ── Imprimir ticket de cocina (fallo silencioso) ──────────────────────────
    cfg = db.query(Configuracion).filter(Configuracion.tenant_id == user.tenant_id).first()
    if cfg and cfg.printer_ip:
        # Recargar pedido con relaciones para tener items y mesa
        pedido_fresco = _load_pedido(pedido_id, user.tenant_id, db)
        mesa_label = None
        if pedido_fresco.mesa:
            mesa_label = f"{pedido_fresco.mesa.numero}"
            if pedido_fresco.mesa.nombre:
                mesa_label += f" - {pedido_fresco.mesa.nombre}"
        items_impresora = [
            {
                "cantidad": it.cantidad,
                "nombre": it.plato.nombre if it.plato else "?",
                "notas": it.nota,
            }
            for it in pedido_fresco.items
        ]
        imprimir_ticket_cocina(
            printer_ip=cfg.printer_ip,
            printer_port=int(cfg.printer_port or 9100),
            pedido_numero=str(pedido_fresco.numero_ticket or pedido_id[:8]),
            mesa=mesa_label,
            tipo=pedido_fresco.tipo or "salon",
            items=items_impresora,
            nota=pedido_fresco.nota_general,
        )

    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))


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

    # ── Todo lo siguiente ocurre en una sola transacción ─────────────────────
    # Si cualquier paso falla, get_db() hace rollback automático y
    # ningún cambio parcial queda guardado en la base de datos.

    pedido.estado = "cerrado"

    # ── Procesar métodos de pago ──────────────────────────────────────────────
    # El campo `pagos` es la nueva forma (lista de {metodo, monto}).
    # Por retrocompatibilidad también aceptamos `metodo_pago` (string simple).
    if data.pagos:
        pagos_lista = [{"metodo": p.metodo, "monto": p.monto} for p in data.pagos]
        pedido.metodo_pago = _serializar_metodo_pago(pagos_lista)
    elif data.metodo_pago:
        pedido.metodo_pago = data.metodo_pago
    else:
        pedido.metodo_pago = "efectivo"

    # Guardar hora_cierre en UTC (naive) para consistencia con hora_apertura
    pedido.hora_cierre = datetime.now(timezone.utc).replace(tzinfo=None)

    # Número de ticket con bloqueo para evitar duplicados en concurrencia
    pedido.numero_ticket = _siguiente_numero_ticket(user.tenant_id, db)

    if data.descuento and data.descuento > 0:
        pedido.total = max(0, float(pedido.total or 0) - float(data.descuento))

    # ── Descontar stock (dentro de la misma transacción) ─────────────────────
    # Si falla aquí, el pedido NO queda cerrado ni el stock parcialmente descontado.
    plato_ids = [item.plato_id for item in pedido.items]
    platos_map = {
        p.id: p for p in db.query(Plato).filter(Plato.id.in_(plato_ids)).all()
    }
    for item in pedido.items:
        plato = platos_map.get(item.plato_id)
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

    if pedido.items and user.rol not in ("admin", "superadmin", "cajero", "mozo"):
        raise HTTPException(status_code=403, detail="No tienes permiso para cancelar este pedido")

    pedido.estado = "cancelado"
    pedido.hora_cierre = datetime.now(timezone.utc).replace(tzinfo=None)
    if pedido.mesa:
        pedido.mesa.estado = "libre"

    db.commit()
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))


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

    pedido.total = max(0, float(pedido.total or 0) - float(item.precio_unitario) * item.cantidad)
    db.delete(item)
    db.commit()
    return _pedido_out(_load_pedido(pedido_id, user.tenant_id, db))