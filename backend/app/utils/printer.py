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
        )
        with socket.create_connection((printer_ip, printer_port), timeout=timeout) as sock:
            sock.sendall(data)
        logger.info("Ticket cocina enviado a %s:%s (pedido %s)", printer_ip, printer_port, pedido_numero)
        return True
    except Exception as exc:
        logger.warning("No se pudo imprimir ticket de cocina: %s", exc)
        return False
