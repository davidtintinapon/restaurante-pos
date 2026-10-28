"""
Utilidad para imprimir tickets de cocina en impresoras térmicas ESC/POS
vía TCP (puerto 9100). Compatible con POS-STAR WP80A y cualquier impresora
de 80 mm con interfaz LAN/WiFi.
"""
import socket
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── ESC/POS constantes ────────────────────────────────────────────────────────
ESC = b'\x1b'
GS  = b'\x1d'

INIT          = ESC + b'@'          # Inicializar impresora
ALIGN_LEFT    = ESC + b'a\x00'
ALIGN_CENTER  = ESC + b'a\x01'
BOLD_ON       = ESC + b'E\x01'
BOLD_OFF      = ESC + b'E\x00'
DOUBLE_HEIGHT = GS  + b'!\x11'     # doble alto + doble ancho
NORMAL_SIZE   = GS  + b'!\x00'
CUT           = GS  + b'V\x41\x03' # corte parcial (avanza 3 mm antes de cortar)
LF            = b'\n'


def _build_ticket(
    pedido_numero: str,
    mesa: Optional[str],
    tipo: str,
    items: list[dict],
    nota: Optional[str] = None,
    nombre_restaurante: Optional[str] = None,
) -> bytes:
    """
    Construye los bytes ESC/POS del ticket de cocina.

    items: lista de dicts con keys 'cantidad', 'nombre', 'notas' (opcional)
    tipo: 'mesa' | 'llevar' | 'delivery'
    """
    COL = 42  # caracteres por línea en 80 mm a densidad normal

    def line(text: str = "") -> bytes:
        return (text + "\n").encode("utf-8", errors="replace")

    def separator() -> bytes:
        return line("-" * COL)

    buf = bytearray()

    # ── Cabecera ──────────────────────────────────────────────────────────────
    buf += INIT
    buf += ALIGN_CENTER
    buf += BOLD_ON + DOUBLE_HEIGHT
    if nombre_restaurante:
        buf += line(nombre_restaurante.upper())
    buf += line("** COCINA **")
    buf += NORMAL_SIZE + BOLD_OFF

    buf += ALIGN_LEFT
    buf += separator()

    # Tipo + mesa/número de pedido
    buf += BOLD_ON
    tipo_label = {
        "mesa":     "MESA",
        "llevar":   "PARA LLEVAR",
        "delivery": "DELIVERY",
    }.get(tipo, tipo.upper())

    if mesa:
        buf += line(f"{tipo_label}: {mesa}")
    else:
        buf += line(tipo_label)

    buf += line(f"Pedido #: {pedido_numero}")
    buf += BOLD_OFF
    buf += separator()

    # ── Items ─────────────────────────────────────────────────────────────────
    for item in items:
        cant   = item.get("cantidad", 1)
        nombre = item.get("nombre", "")
        notas  = item.get("notas") or ""

        buf += BOLD_ON
        buf += line(f"{cant}x  {nombre}")
        buf += BOLD_OFF

        if notas:
            buf += line(f"    -> {notas}")

    buf += separator()

    # Nota general del pedido
    if nota:
        buf += line(f"NOTA: {nota}")
        buf += separator()

    # ── Pie ───────────────────────────────────────────────────────────────────
    buf += LF * 2
    buf += CUT

    return bytes(buf)


def imprimir_ticket_cocina(
    printer_ip: str,
    printer_port: int = 9100,
    *,
    pedido_numero: str,
    mesa: Optional[str],
    tipo: str,
    items: list[dict],
    nota: Optional[str] = None,
    nombre_restaurante: Optional[str] = None,
    timeout: float = 5.0,
) -> bool:
    """
    Envía el ticket de cocina a la impresora vía TCP.
    Retorna True si tuvo éxito, False en cualquier error (fallo silencioso).
    """
    try:
        data = _build_ticket(
            pedido_numero=pedido_numero,
            mesa=mesa,
            tipo=tipo,
            items=items,
            nota=nota,
            nombre_restaurante=nombre_restaurante,
        )
        with socket.create_connection((printer_ip, printer_port), timeout=timeout) as sock:
            sock.sendall(data)
        logger.info("Ticket cocina enviado a %s:%s (pedido %s)", printer_ip, printer_port, pedido_numero)
        return True
    except Exception as exc:
        logger.warning("No se pudo imprimir ticket de cocina: %s", exc)
        return False


def _build_ticket_caja(
    nombre_restaurante: str,
    ruc: str | None,
    direccion: str | None,
    pie: str | None,
    pedido_numero: str,
    fecha: str,
    hora: str,
    encabezado: str,
    nombre_mozo: str | None,
    items: list[dict],
    subtotal: float,
    descuento: float,
    total: float,
    pagos: list[dict],
    vuelto: float,
) -> bytes:
    """
    Construye los bytes ESC/POS del ticket de caja (con precios, total, pagos).
    items: lista de dicts con keys 'cantidad', 'nombre', 'precio_unitario', 'nota' (opcional)
    pagos: lista de dicts con keys 'metodo', 'monto'
    """
    COL = 42

    def line(text: str = "") -> bytes:
        return (text + "\n").encode("utf-8", errors="replace")

    def row(left: str, right: str) -> bytes:
        space = COL - len(left) - len(right)
        if space < 1:
            space = 1
        return line(left + " " * space + right)

    def separator(solid=False) -> bytes:
        char = "=" if solid else "-"
        return line(char * COL)

    buf = bytearray()
    buf += INIT
    buf += ALIGN_CENTER
    buf += BOLD_ON + DOUBLE_HEIGHT
    buf += line(nombre_restaurante.upper())
    buf += NORMAL_SIZE + BOLD_OFF

    if ruc:
        buf += line(f"RUC: {ruc}")
    if direccion:
        buf += line(direccion)

    buf += ALIGN_LEFT
    buf += separator(solid=True)

    if pedido_numero:
        buf += ALIGN_CENTER
        buf += BOLD_ON
        buf += line(f"Ticket #{pedido_numero}")
        buf += BOLD_OFF
        buf += ALIGN_LEFT

    buf += row(fecha, hora)
    buf += BOLD_ON
    buf += line(encabezado)
    buf += BOLD_OFF
    if nombre_mozo:
        buf += line(f"Mozo: {nombre_mozo}")

    buf += separator()
    buf += BOLD_ON
    buf += row("CANT  DESCRIPCION", "PRECIO")
    buf += BOLD_OFF
    buf += separator()

    for item in items:
        cant = item.get("cantidad", 1)
        nombre = item.get("nombre", "")
        precio_u = float(item.get("precio_unitario", 0))
        subtotal_item = cant * precio_u
        nota = item.get("nota") or ""
        buf += line(f"{cant}x {nombre[:28]:<28} S/{subtotal_item:.2f}")
        if nota:
            buf += line(f"    -> {nota}")

    buf += separator()
    buf += row("Subtotal", f"S/{subtotal:.2f}")
    if descuento > 0:
        buf += row("Descuento", f"- S/{descuento:.2f}")
    buf += BOLD_ON
    buf += row("TOTAL", f"S/{total:.2f}")
    buf += BOLD_OFF
    buf += separator()

    for pago in pagos:
        metodo = pago.get("metodo", "").capitalize()
        monto = float(pago.get("monto", 0))
        buf += row(metodo, f"S/{monto:.2f}")
    if vuelto > 0:
        buf += row("Vuelto", f"S/{vuelto:.2f}")

    buf += separator(solid=True)
    buf += ALIGN_CENTER
    buf += line(pie or "¡Gracias por su visita!")
    buf += ALIGN_LEFT
    buf += LF * 2
    buf += CUT

    return bytes(buf)


def imprimir_ticket_caja(
    printer_ip: str,
    printer_port: int = 9100,
    *,
    nombre_restaurante: str,
    ruc: str | None = None,
    direccion: str | None = None,
    pie: str | None = None,
    pedido_numero: str,
    fecha: str,
    hora: str,
    encabezado: str,
    nombre_mozo: str | None = None,
    items: list[dict],
    subtotal: float,
    descuento: float = 0.0,
    total: float,
    pagos: list[dict],
    vuelto: float = 0.0,
    timeout: float = 5.0,
) -> bool:
    """
    Envía el ticket de caja a la impresora vía TCP.
    Retorna True si tuvo éxito, False en cualquier error (fallo silencioso).
    """
    try:
        data = _build_ticket_caja(
            nombre_restaurante=nombre_restaurante,
            ruc=ruc,
            direccion=direccion,
            pie=pie,
            pedido_numero=pedido_numero,
            fecha=fecha,
            hora=hora,
            encabezado=encabezado,
            nombre_mozo=nombre_mozo,
            items=items,
            subtotal=subtotal,
            descuento=descuento,
            total=total,
            pagos=pagos,
            vuelto=vuelto,
        )
        with socket.create_connection((printer_ip, printer_port), timeout=timeout) as sock:
            sock.sendall(data)
        logger.info("Ticket caja enviado a %s:%s (pedido %s)", printer_ip, printer_port, pedido_numero)
        return True
    except Exception as exc:
        logger.warning("No se pudo imprimir ticket de caja: %s", exc)
        return False
