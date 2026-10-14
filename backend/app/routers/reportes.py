from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
from ..core.database import get_db
from ..deps import require_admin, get_current_user
from ..models import Pedido, ItemPedido, Plato, Usuario, Mesa

router = APIRouter(prefix="/reportes", tags=["reportes"])


def _rango_hoy(tz_offset: int = -5) -> tuple[datetime, datetime]:
    ahora_utc = datetime.now(timezone.utc)
    inicio_local = (ahora_utc + timedelta(hours=tz_offset)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    inicio_utc = inicio_local - timedelta(hours=tz_offset)
    fin_utc = inicio_utc + timedelta(days=1)
    return inicio_utc.replace(tzinfo=None), fin_utc.replace(tzinfo=None)


def _rango_mes(tz_offset: int = -5) -> tuple[datetime, datetime]:
    ahora_utc = datetime.now(timezone.utc)
    local = ahora_utc + timedelta(hours=tz_offset)
    inicio_local = local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    inicio_utc = inicio_local - timedelta(hours=tz_offset)
    if local.month == 12:
        fin_local = inicio_local.replace(year=local.year + 1, month=1)
    else:
        fin_local = inicio_local.replace(month=local.month + 1)
    fin_utc = fin_local - timedelta(hours=tz_offset)
    return inicio_utc.replace(tzinfo=None), fin_utc.replace(tzinfo=None)


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    tid = user.tenant_id
    hoy_ini, hoy_fin = _rango_hoy()
    mes_ini, mes_fin = _rango_mes()

    ventas_hoy = db.query(func.coalesce(func.sum(Pedido.total), 0)).filter(
        Pedido.tenant_id == tid,
        Pedido.estado == "cerrado",
        Pedido.hora_cierre >= hoy_ini,
        Pedido.hora_cierre < hoy_fin,
    ).scalar()

    pedidos_hoy = db.query(func.count(Pedido.id)).filter(
        Pedido.tenant_id == tid,
        Pedido.estado == "cerrado",
        Pedido.hora_cierre >= hoy_ini,
        Pedido.hora_cierre < hoy_fin,
    ).scalar()

    ventas_mes = db.query(func.coalesce(func.sum(Pedido.total), 0)).filter(
        Pedido.tenant_id == tid,
        Pedido.estado == "cerrado",
        Pedido.hora_cierre >= mes_ini,
        Pedido.hora_cierre < mes_fin,
    ).scalar()

    pedidos_activos = db.query(func.count(Pedido.id)).filter(
        Pedido.tenant_id == tid,
        Pedido.estado.in_(["abierto", "en_cocina", "listo"]),
    ).scalar()

    mesas_ocupadas = db.query(func.count(Mesa.id)).filter(
        Mesa.tenant_id == tid,
        Mesa.estado == "ocupada",
        Mesa.activo == True,
    ).scalar()

    ticket_promedio = round(float(ventas_hoy) / pedidos_hoy, 2) if pedidos_hoy else 0

    return {
        "ventas_hoy":      float(ventas_hoy),
        "pedidos_hoy":     pedidos_hoy,
        "ventas_mes":      float(ventas_mes),
        "pedidos_activos": pedidos_activos,
        "mesas_ocupadas":  mesas_ocupadas,
        "ticket_promedio": ticket_promedio,
    }


@router.get("/ventas_diarias")
def ventas_diarias(
    dias: int = Query(default=7, ge=1, le=90),
    fecha_ini: str = Query(default=None),
    fecha_fin: str = Query(default=None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    tid = user.tenant_id
    resultado = []

    if fecha_ini and fecha_fin:
        ini = datetime.strptime(fecha_ini, "%Y-%m-%d").date()
        fin = datetime.strptime(fecha_fin, "%Y-%m-%d").date()
        dias_rango = (fin - ini).days + 1
        fechas = [ini + timedelta(days=i) for i in range(dias_rango)]
    else:
        fechas = []
        for i in range(dias - 1, -1, -1):
            fecha_utc = datetime.now(timezone.utc) - timedelta(days=i)
            fechas.append((fecha_utc + timedelta(hours=-5)).date())

    for dia_local in fechas:
        ini_utc = datetime(dia_local.year, dia_local.month, dia_local.day) + timedelta(hours=5)
        fin_utc = ini_utc + timedelta(days=1)
        total = db.query(func.coalesce(func.sum(Pedido.total), 0)).filter(
            Pedido.tenant_id == tid,
            Pedido.estado == "cerrado",
            Pedido.hora_cierre >= ini_utc,
            Pedido.hora_cierre < fin_utc,
        ).scalar()
        resultado.append({"fecha": dia_local.strftime("%d/%m"), "total": float(total)})

    return resultado


@router.get("/platos_populares")
def platos_populares(
    limite: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    tid = user.tenant_id
    mes_ini, mes_fin = _rango_mes()

    rows = db.query(
        Plato.nombre,
        func.sum(ItemPedido.cantidad).label("total_unidades"),
        func.sum(ItemPedido.cantidad * ItemPedido.precio_unitario).label("total_venta"),
    ).join(ItemPedido, ItemPedido.plato_id == Plato.id
    ).join(Pedido, Pedido.id == ItemPedido.pedido_id
    ).filter(
        Pedido.tenant_id == tid,
        Pedido.estado == "cerrado",
        Pedido.hora_cierre >= mes_ini,
        Pedido.hora_cierre < mes_fin,
    ).group_by(Plato.nombre
    ).order_by(func.sum(ItemPedido.cantidad).desc()
    ).limit(limite).all()

    return [
        {"nombre": r.nombre, "unidades": int(r.total_unidades), "venta_total": float(r.total_venta)}
        for r in rows
    ]


@router.get("/metodos_pago")
def metodos_pago(
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    tid = user.tenant_id
    mes_ini, mes_fin = _rango_mes()

    rows = db.query(
        Pedido.metodo_pago,
        func.count(Pedido.id).label("cantidad"),
        func.sum(Pedido.total).label("total"),
    ).filter(
        Pedido.tenant_id == tid,
        Pedido.estado == "cerrado",
        Pedido.hora_cierre >= mes_ini,
        Pedido.hora_cierre < mes_fin,
        Pedido.metodo_pago.isnot(None),
    ).group_by(Pedido.metodo_pago).all()

    return [
        {"metodo": r.metodo_pago or "sin_definir", "cantidad": r.cantidad, "total": float(r.total or 0)}
        for r in rows
    ]


@router.get("/cierre_diario")
def cierre_diario(
    fecha: str = Query(default=None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    tid = user.tenant_id

    if fecha:
        dia = datetime.strptime(fecha, "%Y-%m-%d").date()
    else:
        dia = (datetime.now(timezone.utc) + timedelta(hours=-5)).date()

    ini_utc = datetime(dia.year, dia.month, dia.day) + timedelta(hours=5)
    fin_utc = ini_utc + timedelta(days=1)

    pedidos = db.query(Pedido).filter(
        Pedido.tenant_id == tid,
        Pedido.estado == "cerrado",
        Pedido.hora_cierre >= ini_utc,
        Pedido.hora_cierre < fin_utc,
    ).all()

    total_general = sum(float(p.total or 0) for p in pedidos)
    por_metodo: dict = {}
    for p in pedidos:
        m = p.metodo_pago or "sin_definir"
        por_metodo[m] = por_metodo.get(m, 0) + float(p.total or 0)

    pedidos_cancelados = db.query(func.count(Pedido.id)).filter(
        Pedido.tenant_id == tid,
        Pedido.estado == "cancelado",
        Pedido.hora_apertura >= ini_utc,
        Pedido.hora_apertura < fin_utc,
    ).scalar()

    return {
        "fecha":              dia.strftime("%Y-%m-%d"),
        "total_pedidos":      len(pedidos),
        "total_general":      total_general,
        "ticket_promedio":    round(total_general / len(pedidos), 2) if pedidos else 0,
        "por_metodo_pago":    {k: float(v) for k, v in por_metodo.items()},
        "pedidos_cancelados": pedidos_cancelados,
    }

@router.get("/pedidos_dia")
def pedidos_dia(
    fecha: str = Query(default=None),
    db: Session = Depends(get_db),
    user: Usuario = Depends(require_admin),
):
    from sqlalchemy.orm import joinedload
    tid = user.tenant_id

    if fecha:
        dia = datetime.strptime(fecha, "%Y-%m-%d").date()
    else:
        dia = (datetime.now(timezone.utc) + timedelta(hours=-5)).date()

    ini_utc = datetime(dia.year, dia.month, dia.day) + timedelta(hours=5)
    fin_utc = ini_utc + timedelta(days=1)

    pedidos = db.query(Pedido).options(
        joinedload(Pedido.mesa),
        joinedload(Pedido.mozo),
    ).filter(
        Pedido.tenant_id == tid,
        Pedido.estado == "cerrado",
        Pedido.hora_cierre >= ini_utc,
        Pedido.hora_cierre < fin_utc,
    ).order_by(Pedido.hora_cierre.desc()).all()

    def fmt_hora(dt):
        if not dt:
            return ""
        from datetime import timezone as tz
        utc = dt.replace(tzinfo=tz.utc)
        local = utc + timedelta(hours=-5)
        return local.strftime("%H:%M")

    return [
        {
            "id": p.id,
            "tipo": p.tipo or "salon",
            "mesa": p.mesa.numero if p.mesa else None,
            "nombre_cliente": p.nombre_cliente,
            "mozo": p.mozo.nombre if p.mozo else "—",
            "hora_apertura": fmt_hora(p.hora_apertura),
            "hora_cierre": fmt_hora(p.hora_cierre),
            "metodo_pago": p.metodo_pago or "sin_definir",
            "total": float(p.total or 0),
        }
        for p in pedidos
    ]