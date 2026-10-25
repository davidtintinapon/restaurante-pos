import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'

function fmt(n) { return `S/. ${Number(n || 0).toFixed(2)}` }
function fmtHora(dt) {
  if (!dt) return ''
  const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z')
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })
}
function fmtFecha(dt) {
  if (!dt) return ''
  const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z')
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' })
}

// ─── Ticket 80mm ─────────────────────────────────────────────────────────────
function TicketImpresion({ pedido, pagosRealizados, descuento, vuelto, restaurante, onClose }) {
  const ticketRef = useRef(null)

  const totalConDesc = Math.max(0, (pedido.total || 0) - (Number(descuento) || 0))

  // Parsear metodo_pago del pedido cerrado (viene como string o JSON)
  let metodosDisplay = []
  if (pagosRealizados && pagosRealizados.length > 0) {
    metodosDisplay = pagosRealizados
  } else if (pedido.metodo_pago) {
    try {
      const parsed = JSON.parse(pedido.metodo_pago)
      if (Array.isArray(parsed)) metodosDisplay = parsed
      else metodosDisplay = [{ metodo: pedido.metodo_pago, monto: totalConDesc }]
    } catch {
      metodosDisplay = [{ metodo: pedido.metodo_pago, monto: totalConDesc }]
    }
  }

  const guardarPDF = () => {
    import('jspdf').then(({ default: jsPDF }) => {
      const doc = new jsPDF({ unit: 'mm', format: [80, 200], orientation: 'portrait' })
      let y = 6
      const cx = 40 // centro
      const W = 72  // ancho útil

      const txt = (texto, x, alin = 'left', bold = false, size = 8) => {
        doc.setFontSize(size)
        doc.setFont('courier', bold ? 'bold' : 'normal')
        doc.text(String(texto), x, y, { align: alin })
        y += size * 0.4 + 1.5
      }
      const sep = (solid = false) => {
        doc.setDrawColor(0)
        doc.setLineDashPattern(solid ? [] : [1, 1], 0)
        doc.line(4, y, W, y)
        y += 3
      }

      const totalConDesc = Math.max(0, (pedido.total || 0) - (Number(descuento) || 0))
      const fecha = fmtFecha(pedido.hora_cierre || pedido.hora_apertura)
      const hora = fmtHora(pedido.hora_cierre || pedido.hora_apertura)

      // Encabezado
      txt((restaurante.nombre || 'Restaurante').toUpperCase(), cx, 'center', true, 11)
      if (restaurante.ruc) txt(`RUC: ${restaurante.ruc}`, cx, 'center', false, 8)
      if (restaurante.direccion) txt(restaurante.direccion, cx, 'center', false, 8)
      sep(true)

      if (pedido.numero_ticket) txt(`Ticket #${pedido.numero_ticket}`, cx, 'center', true, 9)
      doc.setFontSize(8); doc.setFont('courier', 'normal')
      doc.text(fecha, 4, y); doc.text(hora, W, y, { align: 'right' }); y += 5

      const enc = pedido.tipo === 'llevar' ? `LLEVAR - ${pedido.nombre_cliente || '—'}`
        : pedido.tipo === 'delivery' ? `DELIVERY - ${pedido.nombre_cliente || '—'}`
        : `Mesa ${pedido.numero_mesa || '—'}`
      txt(enc, 4, 'left', true, 8)
      if (pedido.nombre_mozo) {
        doc.setFontSize(8); doc.setFont('courier', 'normal')
        doc.text('Mozo:', 4, y); doc.text(pedido.nombre_mozo, W, y, { align: 'right' }); y += 4
      }
      sep()

      // Items
      doc.setFontSize(8); doc.setFont('courier', 'bold')
      doc.text('CANT', 4, y); doc.text('DESCRIPCIÓN', 14, y); doc.text('PRECIO', W, y, { align: 'right' }); y += 4
      sep()
      doc.setFont('courier', 'normal')
      pedido.items.forEach(it => {
        const sub = (Number(it.precio_unitario) * Number(it.cantidad)).toFixed(2)
        doc.setFontSize(8)
        doc.text(String(it.cantidad), 4, y)
        doc.text(it.nombre_plato.substring(0, 22), 14, y)
        doc.text(`S/${sub}`, W, y, { align: 'right' })
        y += 4
        if (it.nota) { doc.setFontSize(7); doc.text(`* ${it.nota}`, 14, y); y += 3.5 }
      })
      sep()

      // Totales
      doc.setFontSize(8); doc.setFont('courier', 'normal')
      doc.text('Subtotal', 4, y); doc.text(`S/${Number(pedido.total || 0).toFixed(2)}`, W, y, { align: 'right' }); y += 4
      if (Number(descuento) > 0) {
        doc.text('Descuento', 4, y); doc.text(`- S/${Number(descuento).toFixed(2)}`, W, y, { align: 'right' }); y += 4
      }
      doc.setFont('courier', 'bold'); doc.setFontSize(10)
      doc.text('TOTAL', 4, y); doc.text(`S/${totalConDesc.toFixed(2)}`, W, y, { align: 'right' }); y += 5
      sep()

      // Métodos de pago
      doc.setFontSize(8); doc.setFont('courier', 'normal')
      metodosDisplay.forEach(p => {
        const label = p.metodo.charAt(0).toUpperCase() + p.metodo.slice(1)
        doc.text(label, 4, y); doc.text(`S/${Number(p.monto).toFixed(2)}`, W, y, { align: 'right' }); y += 4
      })
      if (vuelto > 0) {
        doc.setFont('courier', 'bold')
        doc.text('Vuelto', 4, y); doc.text(`S/${Number(vuelto).toFixed(2)}`, W, y, { align: 'right' }); y += 4
      }
      sep(true)

      // Pie
      doc.setFontSize(8); doc.setFont('courier', 'normal')
      doc.text(restaurante.pie || '¡Gracias por su visita!', cx, y, { align: 'center' })

      // Ajustar altura del doc al contenido
      doc.save(`ticket-${pedido.numero_ticket || pedido.id}.pdf`)
    })
  }

  const imprimir = () => {
    const estilo = `
      <style>
        @page { margin: 0; size: 80mm auto; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 11px;
               width: 72mm; padding: 4mm 4mm 8mm 4mm; color: #000; background: #fff; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .big { font-size: 14px; font-weight: bold; }
        .sep { border-top: 1px dashed #000; margin: 4px 0; }
        .sep-solid { border-top: 1px solid #000; margin: 4px 0; }
        .row { display: flex; justify-content: space-between; }
        .row-item { display: flex; gap: 4px; margin: 2px 0; }
        .row-item .cant { min-width: 18px; text-align: right; }
        .row-item .nombre { flex: 1; }
        .row-item .precio { min-width: 46px; text-align: right; }
        .total-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin-top: 4px; }
        .nota-item { font-size: 10px; color: #555; padding-left: 22px; font-style: italic; }
        .footer { text-align: center; font-size: 10px; margin-top: 6px; }
        .ticket-num { font-size: 12px; font-weight: bold; }
      </style>
    `

    const fecha = fmtFecha(pedido.hora_cierre || pedido.hora_apertura)
    const hora = fmtHora(pedido.hora_cierre || pedido.hora_apertura)

    let encabezado = ''
    if (pedido.tipo === 'salon' || pedido.tipo === 'mesa' || !pedido.tipo) {
      encabezado = `Mesa ${pedido.numero_mesa || '—'}`
    } else if (pedido.tipo === 'llevar') {
      encabezado = `PARA LLEVAR — ${pedido.nombre_cliente || '—'}`
    } else if (pedido.tipo === 'delivery') {
      encabezado = `DELIVERY — ${pedido.nombre_cliente || pedido.telefono_delivery || '—'}`
    }

    const itemsHTML = pedido.items.map(it => {
      const subtotal = Number(it.precio_unitario) * Number(it.cantidad)
      const notaLine = it.nota ? `<div class="nota-item">* ${it.nota}</div>` : ''
      return `
        <div class="row-item">
          <span class="cant">${it.cantidad}</span>
          <span class="nombre">${it.nombre_plato}</span>
          <span class="precio">S/${subtotal.toFixed(2)}</span>
        </div>
        ${notaLine}
      `
    }).join('')

    const descuentoLine = Number(descuento) > 0
      ? `<div class="row"><span>Descuento</span><span>- S/${Number(descuento).toFixed(2)}</span></div>`
      : ''

    const metodosHTML = metodosDisplay.map(p => {
      const label = p.metodo.charAt(0).toUpperCase() + p.metodo.slice(1)
      return `<div class="row"><span>${label}</span><span>S/${Number(p.monto).toFixed(2)}</span></div>`
    }).join('')

    const vueltoLine = vuelto > 0
      ? `<div class="row"><span>Vuelto</span><span>S/${Number(vuelto).toFixed(2)}</span></div>`
      : ''

    const rucLine = restaurante.ruc ? `<div>${restaurante.ruc ? 'RUC: ' + restaurante.ruc : ''}</div>` : ''
    const dirLine = restaurante.direccion ? `<div>${restaurante.direccion}</div>` : ''
    const mozoLine = pedido.nombre_mozo ? `<div class="row"><span>Mozo:</span><span>${pedido.nombre_mozo}</span></div>` : ''
    const ticketNum = pedido.numero_ticket ? `<div class="ticket-num center">Ticket #${pedido.numero_ticket}</div>` : ''

    const html = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8">${estilo}</head>
      <body>
        <div class="big center">${(restaurante.nombre || 'Restaurante').toUpperCase()}</div>
        ${rucLine}
        ${dirLine}
        <div class="sep-solid"></div>
        ${ticketNum}
        <div class="row"><span>${fecha}</span><span>${hora}</span></div>
        <div class="bold">${encabezado}</div>
        ${mozoLine}
        <div class="sep"></div>
        <div class="row bold"><span>CANT  DESCRIPCIÓN</span><span>PRECIO</span></div>
        <div class="sep"></div>
        ${itemsHTML}
        <div class="sep"></div>
        <div class="row"><span>Subtotal</span><span>S/${Number(pedido.total || 0).toFixed(2)}</span></div>
        ${descuentoLine}
        <div class="total-row"><span>TOTAL</span><span>S/${totalConDesc.toFixed(2)}</span></div>
        <div class="sep"></div>
        ${metodosHTML}
        ${vueltoLine}
        <div class="sep-solid"></div>
        <div class="footer">${restaurante.pie || '¡Gracias por su visita!'}</div>
      </body>
      </html>
    `

    const ventana = window.open('', '_blank', 'width=340,height=600')
    ventana.document.write(html)
    ventana.document.close()
    ventana.focus()
    ventana.print()
    // No cerrar automáticamente — el usuario cierra tras imprimir
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Vista previa del ticket */}
      <div
        ref={ticketRef}
        className="bg-white text-black rounded-lg p-4 mx-auto text-xs font-mono"
        style={{ width: '240px', minHeight: '300px' }}
      >
        <div className="text-center font-bold text-sm">
          {(restaurante.nombre || 'Restaurante').toUpperCase()}
        </div>
        {restaurante.ruc && (
          <div className="text-center text-xs">RUC: {restaurante.ruc}</div>
        )}
        {restaurante.direccion && (
          <div className="text-center text-xs">{restaurante.direccion}</div>
        )}
        <div className="border-t border-black border-dashed my-1" />
        {pedido.numero_ticket && (
          <div className="text-center font-bold">Ticket #{pedido.numero_ticket}</div>
        )}
        <div className="flex justify-between text-xs">
          <span>{fmtFecha(pedido.hora_cierre || pedido.hora_apertura)}</span>
          <span>{fmtHora(pedido.hora_cierre || pedido.hora_apertura)}</span>
        </div>
        <div className="font-bold text-xs">
          {pedido.tipo === 'llevar' ? `LLEVAR — ${pedido.nombre_cliente || '—'}`
           : pedido.tipo === 'delivery' ? `DELIVERY — ${pedido.nombre_cliente || '—'}`
           : `Mesa ${pedido.numero_mesa || '—'}`}
        </div>
        {pedido.nombre_mozo && (
          <div className="flex justify-between text-xs">
            <span>Mozo:</span><span>{pedido.nombre_mozo}</span>
          </div>
        )}
        <div className="border-t border-black border-dashed my-1" />
        {pedido.items.map(it => (
          <div key={it.id}>
            <div className="flex gap-1 text-xs">
              <span className="w-4 text-right">{it.cantidad}</span>
              <span className="flex-1 truncate">{it.nombre_plato}</span>
              <span className="w-12 text-right">
                S/{(Number(it.precio_unitario) * Number(it.cantidad)).toFixed(2)}
              </span>
            </div>
            {it.nota && <div className="text-xs text-gray-500 italic pl-5">* {it.nota}</div>}
          </div>
        ))}
        <div className="border-t border-black border-dashed my-1" />
        <div className="flex justify-between text-xs">
          <span>Subtotal</span>
          <span>S/{Number(pedido.total || 0).toFixed(2)}</span>
        </div>
        {Number(descuento) > 0 && (
          <div className="flex justify-between text-xs text-green-700">
            <span>Descuento</span>
            <span>- S/{Number(descuento).toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>TOTAL</span>
          <span>S/{totalConDesc.toFixed(2)}</span>
        </div>
        <div className="border-t border-black my-1" />
        {metodosDisplay.map((p, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="capitalize">{p.metodo}</span>
            <span>S/{Number(p.monto).toFixed(2)}</span>
          </div>
        ))}
        {vuelto > 0 && (
          <div className="flex justify-between text-xs font-bold">
            <span>Vuelto</span>
            <span>S/{Number(vuelto).toFixed(2)}</span>
          </div>
        )}
        <div className="border-t border-black border-dashed my-1" />
        <div className="text-center text-xs">{restaurante.pie || '¡Gracias por su visita!'}</div>
      </div>

      {/* Botones */}
      <div className="flex gap-2">
        <button
          onClick={imprimir}
          className="btn-primary flex-1 flex items-center justify-center gap-1 text-sm"
        >
          Imprimir
        </button>
        <button
          onClick={guardarPDF}
          className="btn-secondary flex-1 flex items-center justify-center gap-1 text-sm"
        >
          Guardar PDF
        </button>
        <button onClick={onClose} className="btn-secondary px-3 text-sm">
          Cerrar
        </button>
      </div>
    </div>
  )
}

// ─── Métodos de pago disponibles ────────────────────────────────────────────
const METODOS = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'yape',          label: 'Yape' },
  { value: 'plin',          label: 'Plin' },
  { value: 'transferencia', label: 'Transferencia' },
]

function initFormCobro() {
  return {
    descuento: 0,
    pagos: [{ metodo: 'efectivo', monto: '' }],
  }
}

export default function Pedido() {
  const { mesa_id, pedido_id } = useParams()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { isAdmin, user } = useAuth()
  const toast = useToast()

  const mesaId  = mesa_id || search.get('mesa_id')
  const mesaNum = search.get('mesa_num')
  const esLlevar = !!pedido_id

  const [pedido, setPedido]   = useState(null)
  const [carta, setCarta]     = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  const [carrito, setCarrito] = useState([])
  const [categoriaAct, setCategoriaAct] = useState(null)
  const [busq, setBusq] = useState('')

  const [modalCobro, setModalCobro] = useState(false)
  const [formCobro, setFormCobro] = useState(initFormCobro())

  const [modalDelivery, setModalDelivery] = useState(false)
  const [formDelivery, setFormDelivery] = useState({ nombre_cliente: '', telefono: '', direccion: '' })

  // ── Ticket ────────────────────────────────────────────────────────────────
  const [modalTicket, setModalTicket] = useState(false)
  const [ticketData, setTicketData] = useState(null)   // { pedido, pagos, descuento, vuelto }
  const [configRestaurante, setConfigRestaurante] = useState(null)

  const cargarPedido = useCallback(async () => {
    try {
      if (esLlevar) {
        const r = await api.get(`/pedidos/${pedido_id}`)
        setPedido(r.data)
      } else if (mesaId) {
        const r = await api.get(`/pedidos/mesa/${mesaId}/activo`)
        setPedido(r.data)
      }
    } catch {
      setPedido(null)
    }
  }, [esLlevar, pedido_id, mesaId])

  const cargarCarta = async () => {
    const r = await api.get('/carta/')
    setCarta(r.data)
    if (r.data.length > 0) setCategoriaAct(r.data[0].id)
  }

  useEffect(() => {
    api.get('/configuracion/').then(r => setConfigRestaurante(r.data)).catch(() => {})
    Promise.all([cargarPedido(), cargarCarta()]).finally(() => setLoading(false))
  }, [mesaId, pedido_id])

  useEffect(() => {
    const interval = setInterval(cargarPedido, 6000)
    return () => clearInterval(interval)
  }, [cargarPedido])

  const agregarAlCarrito = plato => {
    setCarrito(c => {
      const existe = c.find(x => x.plato.id === plato.id)
      if (existe) return c.map(x => x.plato.id === plato.id ? { ...x, cantidad: x.cantidad + 1 } : x)
      return [...c, { plato, cantidad: 1, nota: '' }]
    })
  }

  const quitarDelCarrito = plato_id => {
    setCarrito(c => c.filter(x => x.plato.id !== plato_id))
  }

  const totalCarrito = carrito.reduce((s, x) => s + x.plato.precio * x.cantidad, 0)

  const enviarItems = async () => {
    if (carrito.length === 0) return
    setSaving(true)
    const items = carrito.map(x => ({ plato_id: x.plato.id, cantidad: x.cantidad, nota: x.nota || null }))
    try {
      if (!pedido) {
        const r = await api.post('/pedidos/', { mesa_id: mesaId, items })
        setPedido(r.data)
      } else {
        const r = await api.post(`/pedidos/${pedido.id}/items`, { items })
        setPedido(r.data)
      }
      setCarrito([])
      toast('Items agregados al pedido', 'success')
    } catch (err) {
      toast(err.response?.data?.detail || 'Error', 'error')
    } finally { setSaving(false) }
  }

  const enviarACocina = async () => {
    setSaving(true)
    try {
      const r = await api.patch(`/pedidos/${pedido.id}/enviar_cocina`)
      setPedido(r.data)
      toast('Pedido enviado a cocina', 'success')
    } catch (err) {
      toast(err.response?.data?.detail || 'Error', 'error')
    } finally { setSaving(false) }
  }

  const eliminarItem = async (item_id) => {
    setSaving(true)
    try {
      const r = await api.delete(`/pedidos/${pedido.id}/items/${item_id}`)
      setPedido(r.data)
      toast('Item eliminado', 'warn')
    } catch (err) {
      toast(err.response?.data?.detail || 'Error', 'error')
    } finally { setSaving(false) }
  }

  // ─── Lógica de cobro ──────────────────────────────────────────────────────
  const totalConDescuento = pedido
    ? Math.max(0, (pedido.total || 0) - (Number(formCobro.descuento) || 0))
    : 0

  const totalPagado = formCobro.pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0)

  const pagoEfectivo = formCobro.pagos
    .filter(p => p.metodo === 'efectivo')
    .reduce((s, p) => s + (Number(p.monto) || 0), 0)

  const pagoNoEfectivo = totalPagado - pagoEfectivo
  const debeEnEfectivo = Math.max(0, totalConDescuento - pagoNoEfectivo)
  const vuelto = pagoEfectivo > 0 ? Math.max(0, pagoEfectivo - debeEnEfectivo) : 0
  const faltaPorPagar = Math.max(0, totalConDescuento - totalPagado)

  const agregarMetodoPago = () => {
    const metodosUsados = formCobro.pagos.map(p => p.metodo)
    const disponible = METODOS.find(m => !metodosUsados.includes(m.value))
    if (!disponible) return
    setFormCobro(f => ({ ...f, pagos: [...f.pagos, { metodo: disponible.value, monto: '' }] }))
  }

  const quitarMetodoPago = (idx) => {
    setFormCobro(f => ({ ...f, pagos: f.pagos.filter((_, i) => i !== idx) }))
  }

  const actualizarPago = (idx, campo, valor) => {
    setFormCobro(f => ({
      ...f,
      pagos: f.pagos.map((p, i) => i === idx ? { ...p, [campo]: valor } : p),
    }))
  }

  const completarMonto = (idx) => {
    if (faltaPorPagar > 0 && !formCobro.pagos[idx].monto) {
      actualizarPago(idx, 'monto', faltaPorPagar.toFixed(2))
    }
  }

  const cobrar = async e => {
    e.preventDefault()
    const pagosValidos = formCobro.pagos.filter(p => Number(p.monto) > 0)
    if (pagosValidos.length === 0) {
      toast('Ingresa al menos un monto de pago', 'error')
      return
    }
    if (totalPagado < totalConDescuento - 0.01) {
      toast(`Falta S/. ${faltaPorPagar.toFixed(2)} por cubrir`, 'error')
      return
    }

    setSaving(true)
    try {
      const resp = await api.patch(`/pedidos/${pedido.id}/cerrar`, {
        pagos: pagosValidos.map(p => ({ metodo: p.metodo, monto: Number(Number(p.monto).toFixed(2)) })),
        descuento: Number(formCobro.descuento) || 0,
      })

      toast('Pedido cobrado correctamente', 'success')
      setModalCobro(false)

      // Guardar datos para el ticket y mostrar modal
      const pedidoCerrado = resp.data
      setTicketData({
        pedido: pedidoCerrado,
        pagos: pagosValidos,
        descuento: Number(formCobro.descuento) || 0,
        vuelto,
      })
      setModalTicket(true)

    } catch (err) {
      toast(err.response?.data?.detail || 'Error', 'error')
    } finally { setSaving(false) }
  }

  const cerrarTicketYNavegar = () => {
    setModalTicket(false)
    navigate(esLlevar ? '/mesas?tab=llevar' : '/mesas')
  }

  const cancelar = async () => {
    if (!confirm('¿Cancelar este pedido?')) return
    await api.patch(`/pedidos/${pedido.id}/cancelar`)
    toast('Pedido cancelado', 'warn')
    navigate(esLlevar ? '/mesas?tab=llevar' : '/mesas')
  }

  const crearDelivery = async e => {
    e.preventDefault()
    if (!formDelivery.telefono || !formDelivery.direccion) {
      toast('Ingresa teléfono y dirección', 'error')
      return
    }
    setSaving(true)
    try {
      const items = carrito.map(x => ({ plato_id: x.plato.id, cantidad: x.cantidad, nota: x.nota || null }))
      const r = await api.post('/pedidos/delivery', {
        nombre_cliente: formDelivery.nombre_cliente,
        telefono: formDelivery.telefono,
        direccion: formDelivery.direccion,
        items,
      })
      setPedido(r.data)
      setCarrito([])
      setModalDelivery(false)
      setFormDelivery({ nombre_cliente: '', telefono: '', direccion: '' })
      toast('Delivery creado', 'success')
    } catch (err) {
      toast(err.response?.data?.detail || 'Error al crear delivery', 'error')
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>

  const catActiva = carta.find(c => c.id === categoriaAct)
  const platos = (catActiva?.platos || []).filter(p =>
    !busq || p.nombre.toLowerCase().includes(busq.toLowerCase())
  )

  const titulo = esLlevar
    ? `LLEVAR — ${pedido?.nombre_cliente || '...'}`
    : pedido?.tipo === 'delivery'
    ? `DELIVERY — ${pedido?.nombre_cliente || pedido?.telefono_delivery || '...'}`
    : `Mesa ${pedido?.numero_mesa || mesaNum}`

  const restauranteInfo = {
    nombre: configRestaurante?.nombre_restaurante || 'Restaurante',
    ruc: configRestaurante?.ruc || null,
    direccion: configRestaurante?.direccion || null,
    pie: configRestaurante?.pie_ticket || '¡Gracias por su visita!',
  }

  return (
    <div className="max-w-7xl h-[calc(100vh-3.5rem-3rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-shrink-0 flex-wrap gap-y-2">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/mesas')} className="text-gray-400 hover:text-gray-100 transition-colors">
            ← Mesas
          </button>
          <h1 className="text-xl font-bold text-gray-100">{titulo}</h1>
          {pedido && <Badge value={pedido.estado} />}
          {pedido?.tipo === 'delivery' && pedido?.direccion_delivery && (
            <span className="text-xs text-gray-500 hidden sm:inline">{pedido.direccion_delivery}</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {!pedido && !esLlevar && (
            <button onClick={() => setModalDelivery(true)} className="btn-secondary">
              Nuevo Delivery
            </button>
          )}
          {pedido && (
            <>
{pedido.estado === 'abierto' && (
                <button onClick={enviarACocina} className="btn-primary" disabled={saving}>
                  Enviar a cocina
                </button>
              )}
              {(isAdmin || user?.rol === 'cajero') && pedido.estado !== 'cerrado' && pedido.estado !== 'cancelado' && (
                <button
                  onClick={() => { setFormCobro(initFormCobro()); setModalCobro(true) }}
                  className="btn-secondary"
                >
                  Cobrar
                </button>
              )}
              {(isAdmin || pedido.items.length === 0) && pedido.estado !== 'cerrado' && pedido.estado !== 'cancelado' && (
                <button onClick={cancelar} className="btn-danger">Cancelar</button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-y-auto">
        {/* Panel izquierdo: carta */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <input
            className="input"
            placeholder="Buscar plato..."
            value={busq}
            onChange={e => setBusq(e.target.value)}
          />
          {!busq && (
            <div className="flex gap-1 overflow-x-auto pb-1 flex-shrink-0">
              {carta.map(cat => (
                <button key={cat.id} onClick={() => setCategoriaAct(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0
                    ${categoriaAct === cat.id ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-100'}`}>
                  {cat.nombre}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {platos.map(p => (
                <button key={p.id} onClick={() => agregarAlCarrito(p)}
                  className="card p-3 text-left hover:border-brand-600 transition-all duration-100
                             hover:scale-[1.02] active:scale-[0.98]">
                  <p className="text-sm font-medium text-gray-100 leading-tight">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{p.descripcion}</p>}
                  <p className="text-brand-400 font-bold mt-2 text-sm">S/. {Number(p.precio).toFixed(2)}</p>
                </button>
              ))}
              {platos.length === 0 && (
                <p className="col-span-3 text-gray-500 text-center py-10">
                  {busq ? 'Sin resultados' : 'Categoría vacía'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Panel derecho: pedido + carrito */}
        <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 flex flex-col gap-3">
          {carrito.length > 0 && (
            <div className="card p-4 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-gray-300">Por agregar</h3>
              <div className="space-y-3 max-h-52 overflow-y-auto">
                {carrito.map(x => (
                  <div key={x.plato.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-sm">
                      <button
                        onClick={() => setCarrito(c => c.map(i => i.plato.id === x.plato.id ? { ...i, cantidad: Math.max(1, i.cantidad - 1) } : i))}
                        className="w-5 h-5 bg-gray-700 rounded text-xs text-gray-300 flex items-center justify-center hover:bg-gray-600">−</button>
                      <span className="w-5 h-5 bg-brand-500/20 text-brand-400 rounded text-xs flex items-center justify-center font-bold">
                        {x.cantidad}
                      </span>
                      <button
                        onClick={() => setCarrito(c => c.map(i => i.plato.id === x.plato.id ? { ...i, cantidad: i.cantidad + 1 } : i))}
                        className="w-5 h-5 bg-gray-700 rounded text-xs text-gray-300 flex items-center justify-center hover:bg-gray-600">+</button>
                      <span className="flex-1 text-gray-200 truncate">{x.plato.nombre}</span>
                      <button onClick={() => quitarDelCarrito(x.plato.id)}
                        className="text-red-400 hover:text-red-300 text-lg leading-none">×</button>
                    </div>
                    <input
                      className="input text-xs py-1 px-2 ml-7"
                      placeholder="Nota: sin tomate, sin sal..."
                      value={x.nota}
                      onChange={e => setCarrito(c => c.map(i => i.plato.id === x.plato.id ? { ...i, nota: e.target.value } : i))}
                    />
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-800 pt-2 flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-gray-100 font-semibold">{fmt(totalCarrito)}</span>
              </div>
              <button onClick={enviarItems} className="btn-primary w-full" disabled={saving}>
                {saving ? <Spinner size="sm" className="mx-auto" /> : '+ Agregar al pedido'}
              </button>
            </div>
          )}

          {pedido && (
            <div className="card p-4 flex flex-col gap-2 flex-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-300">Pedido actual</h3>
                <span className="text-xs text-gray-500">{fmtHora(pedido.hora_apertura)}</span>
              </div>
              {pedido.tipo === 'delivery' && (
                <div className="text-xs text-gray-500 space-y-0.5 pb-1 border-b border-gray-800">
                  {pedido.telefono_delivery && <p>{pedido.telefono_delivery}</p>}
                  {pedido.direccion_delivery && <p>{pedido.direccion_delivery}</p>}
                </div>
              )}
              <div className="flex-1 overflow-y-auto space-y-2">
                {pedido.items.map(item => (
                  <div key={item.id} className="flex items-start gap-2 text-sm">
                    <span className="w-5 h-5 bg-gray-800 rounded text-xs flex items-center justify-center text-gray-300 flex-shrink-0 mt-0.5">
                      {item.cantidad}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-200 truncate">{item.nombre_plato}</p>
                      {item.nota && <p className="text-xs text-gray-500 italic">{item.nota}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-gray-400 text-xs">{fmt(item.precio_unitario * item.cantidad)}</span>
                      <Badge value={item.estado} />
                      {item.estado === 'pendiente' && (
                        <button onClick={() => eliminarItem(item.id)}
                          className="text-red-400 hover:text-red-300 text-xs mt-0.5">
                          × quitar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {pedido.items.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-4">Sin items aún</p>
                )}
              </div>
              <div className="border-t border-gray-800 pt-2 flex justify-between">
                <span className="text-gray-400 text-sm">Total</span>
                <span className="text-lg font-bold text-brand-400">{fmt(pedido.total)}</span>
              </div>
            </div>
          )}

          {!pedido && carrito.length === 0 && (
            <div className="card p-6 text-center text-gray-500">
              <p className="text-sm">Selecciona platos para crear el pedido</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Modal cobro ──────────────────────────────────────────────────────── */}
      <Modal open={modalCobro} onClose={() => setModalCobro(false)} title="Cobrar pedido">
        {pedido && (
          <form onSubmit={cobrar} className="space-y-4">
            <div className="rounded-xl bg-gray-800/60 border border-gray-700 p-3 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-400">
                <span>Subtotal</span>
                <span>{fmt(pedido.total)}</span>
              </div>
              {Number(formCobro.descuento) > 0 && (
                <div className="flex justify-between text-sm text-green-400">
                  <span>Descuento</span>
                  <span>− {fmt(formCobro.descuento)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-gray-700 pt-1.5">
                <span className="text-gray-200">Total a pagar</span>
                <span className="text-brand-400 text-lg">{fmt(totalConDescuento)}</span>
              </div>
            </div>

            <div>
              <label className="label">Descuento (S/.)</label>
              <input
                type="number" className="input" min={0} max={pedido.total} step={0.01}
                placeholder="0.00"
                value={formCobro.descuento}
                onChange={e => setFormCobro(f => ({ ...f, descuento: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label mb-0">Método(s) de pago</label>
                {formCobro.pagos.length < METODOS.length && (
                  <button type="button" onClick={agregarMetodoPago} className="text-xs text-brand-400 hover:text-brand-300">
                    + Agregar método
                  </button>
                )}
              </div>

              {formCobro.pagos.map((pago, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-1 flex-1">
                      {METODOS.map(m => {
                        const usadoEnOtro = formCobro.pagos.some((p, i) => i !== idx && p.metodo === m.value)
                        return (
                          <button
                            key={m.value}
                            type="button"
                            disabled={usadoEnOtro}
                            onClick={() => actualizarPago(idx, 'metodo', m.value)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors
                              ${pago.metodo === m.value
                                ? 'bg-brand-500 border-brand-500 text-white'
                                : usadoEnOtro
                                ? 'opacity-20 cursor-not-allowed bg-gray-800 border-gray-700 text-gray-500'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-100'}`}
                          >
                            {m.label}
                          </button>
                        )
                      })}
                    </div>
                    <div className="relative w-28 flex-shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">S/.</span>
                      <input
                        type="number" className="input pl-8 pr-2 text-right"
                        min={0} step={0.01} placeholder="0.00"
                        value={pago.monto}
                        onFocus={() => completarMonto(idx)}
                        onChange={e => actualizarPago(idx, 'monto', e.target.value)}
                      />
                    </div>
                    {formCobro.pagos.length > 1 && (
                      <button type="button" onClick={() => quitarMetodoPago(idx)}
                        className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0">
                        ×
                      </button>
                    )}
                  </div>
                  {pago.metodo === 'efectivo' && Number(pago.monto) > 0 && (
                    <div className={`flex justify-between text-sm font-semibold px-1
                      ${vuelto > 0 ? 'text-green-400' : Number(pago.monto) < debeEnEfectivo ? 'text-red-400' : 'text-gray-400'}`}>
                      <span>Vuelto</span>
                      <span>
                        {vuelto > 0
                          ? fmt(vuelto)
                          : Number(pago.monto) < debeEnEfectivo
                          ? `Faltan ${fmt(debeEnEfectivo - Number(pago.monto))}`
                          : 'S/. 0.00'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {totalConDescuento > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Pagado</span>
                  <span className={faltaPorPagar > 0 ? 'text-yellow-400' : 'text-green-400'}>
                    {fmt(Math.min(totalPagado, totalConDescuento))}
                    {faltaPorPagar > 0 && ` / faltan ${fmt(faltaPorPagar)}`}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${faltaPorPagar <= 0 ? 'bg-green-500' : 'bg-brand-500'}`}
                    style={{ width: `${Math.min(100, (totalPagado / totalConDescuento) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {formCobro.pagos.filter(p => Number(p.monto) > 0).length > 1 && (
              <div className="rounded-lg bg-gray-800/40 border border-gray-700 p-2.5 space-y-1">
                <p className="text-xs text-gray-500 font-medium mb-1.5">Desglose del pago</p>
                {formCobro.pagos.filter(p => Number(p.monto) > 0).map((p, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-gray-400 capitalize">{p.metodo}</span>
                    <span className="text-gray-200">{fmt(p.monto)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="submit" className="btn-primary flex-1"
                disabled={saving || faltaPorPagar > 0.01}
              >
                {saving
                  ? <Spinner size="sm" className="mx-auto" />
                  : faltaPorPagar > 0.01
                  ? `Faltan ${fmt(faltaPorPagar)}`
                  : 'Confirmar cobro'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setModalCobro(false)}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ─── Modal Ticket ─────────────────────────────────────────────────────── */}
      <Modal open={modalTicket} onClose={cerrarTicketYNavegar} title="Ticket de venta">
        {ticketData && (
          <TicketImpresion
            pedido={ticketData.pedido}
            pagosRealizados={ticketData.pagos}
            descuento={ticketData.descuento}
            vuelto={ticketData.vuelto}
            restaurante={restauranteInfo}
            onClose={cerrarTicketYNavegar}
          />
        )}
      </Modal>

      {/* ─── Modal Delivery ───────────────────────────────────────────────────── */}
      <Modal open={modalDelivery} onClose={() => setModalDelivery(false)} title="Nuevo Delivery">
        <form onSubmit={crearDelivery} className="space-y-4">
          <div>
            <label className="label">Nombre cliente (opcional)</label>
            <input className="input" placeholder="Ej: Juan Pérez"
              value={formDelivery.nombre_cliente}
              onChange={e => setFormDelivery(f => ({ ...f, nombre_cliente: e.target.value }))} />
          </div>
          <div>
            <label className="label">Teléfono *</label>
            <input className="input" placeholder="Ej: 987654321"
              value={formDelivery.telefono}
              onChange={e => setFormDelivery(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div>
            <label className="label">Dirección *</label>
            <input className="input" placeholder="Ej: Av. Los Pinos 123, Urb. El Sol"
              value={formDelivery.direccion}
              onChange={e => setFormDelivery(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          {carrito.length > 0 ? (
            <div className="card p-3 bg-gray-800 text-sm space-y-1">
              {carrito.map(x => (
                <div key={x.plato.id} className="flex justify-between text-gray-300">
                  <span>{x.cantidad}× {x.plato.nombre}</span>
                  <span>{fmt(x.plato.precio * x.cantidad)}</span>
                </div>
              ))}
              <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between font-bold text-gray-100">
                <span>Total</span><span className="text-brand-400">{fmt(totalCarrito)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-yellow-500 bg-yellow-500/10 rounded-lg px-3 py-2">
              Agrega platos al carrito antes de crear el delivery
            </p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={saving || carrito.length === 0}>
              {saving ? <Spinner size="sm" className="mx-auto" /> : 'Crear Delivery'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalDelivery(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
