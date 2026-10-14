import { useEffect, useState } from 'react'
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

function imprimirCuenta(pedido, nombreRestaurante = 'Restaurante', ruc = null, direccion = null) {
  import('jspdf').then(({ default: jsPDF }) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })
    let y = 15
    const txt = (texto, x = 10, bold = false, size = 9) => {
      doc.setFontSize(size)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.text(String(texto), x, y)
      y += size * 0.5 + 2
    }
    const sep = () => {
      doc.setDrawColor(150)
      doc.line(10, y, 138, y)
      y += 4
    }
    // Cabecera
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(nombreRestaurante.toUpperCase(), 74, y, { align: 'center' })
    y += 8
    if (ruc) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`RUC: ${ruc}`, 74, y, { align: 'center' })
      y += 5
    }
    if (direccion) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(direccion, 74, y, { align: 'center' })
      y += 5
    }
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Cuenta de consumo', 74, y, { align: 'center' })
    y += 6
    sep()
    // Info mesa/cliente
    if (pedido.tipo === 'llevar') {
      txt(`Cliente: ${pedido.nombre_cliente || '—'}`, 10, true)
    } else {
      txt(`Mesa: ${pedido.numero_mesa}`, 10, true)
    }
    txt(`Mozo: ${pedido.nombre_mozo}`)
    txt(`Hora: ${fmtHora(pedido.hora_apertura)}`)
    sep()
    txt('Cant.', 10, true)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Descripción', 25, y - 5)
    doc.text('Precio', 120, y - 5, { align: 'right' })
    sep()
    pedido.items.forEach(item => {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(String(item.cantidad), 10, y)
      doc.text(item.nombre_plato, 25, y)
      doc.text(fmt(item.precio_unitario * item.cantidad), 128, y, { align: 'right' })
      y += 6
    })
    sep()
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL:', 80, y)
    doc.text(fmt(pedido.total), 128, y, { align: 'right' })
    y += 10
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('¡Gracias por su visita!', 74, y, { align: 'center' })
    doc.save(`cuenta-${pedido.tipo === 'llevar' ? pedido.nombre_cliente : 'mesa-' + pedido.numero_mesa}.pdf`)
  })
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
  const [formCobro, setFormCobro] = useState({ metodo_pago: 'efectivo', descuento: 0 })

  const cargarPedido = async () => {
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
  }

  const cargarCarta = async () => {
    const r = await api.get('/carta/')
    setCarta(r.data)
    if (r.data.length > 0) setCategoriaAct(r.data[0].id)
  }

  useEffect(() => {
    Promise.all([cargarPedido(), cargarCarta()]).finally(() => setLoading(false))
  }, [mesaId, pedido_id])

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
      toast('Pedido enviado a cocina 🔥', 'success')
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

  const cobrar = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.patch(`/pedidos/${pedido.id}/cerrar`, {
        metodo_pago: formCobro.metodo_pago,
        descuento: Number(formCobro.descuento) || 0,
      })
      toast('Pedido cobrado correctamente ✅', 'success')
      navigate('/mesas')
    } catch (err) {
      toast(err.response?.data?.detail || 'Error', 'error')
    } finally { setSaving(false) }
  }

  const cancelar = async () => {
    if (!confirm('¿Cancelar este pedido?')) return
    await api.patch(`/pedidos/${pedido.id}/cancelar`)
    toast('Pedido cancelado', 'warn')
    navigate(esLlevar ? '/mesas?tab=llevar' : '/mesas')
  }

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>

  const catActiva = carta.find(c => c.id === categoriaAct)
  const platos = (catActiva?.platos || []).filter(p =>
    !busq || p.nombre.toLowerCase().includes(busq.toLowerCase())
  )

  const titulo = esLlevar
    ? `🥡 LLEVAR — ${pedido?.nombre_cliente || '...'}`
    : `Mesa ${pedido?.numero_mesa || mesaNum}`

  return (
    <div className="max-w-7xl h-[calc(100vh-3.5rem-3rem)] flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/mesas')} className="text-gray-400 hover:text-gray-100 transition-colors">
            ← Mesas
          </button>
          <h1 className="text-xl font-bold text-gray-100">{titulo}</h1>
          {pedido && <Badge value={pedido.estado} />}
        </div>
        {pedido && (
          <div className="flex gap-2">
            {/* Botón Ver cuenta — visible para mozo, cajero y admin */}
            <button
            onClick={() => imprimirCuenta(pedido, user?.nombre_restaurante || 'Restaurante', user?.ruc, user?.direccion)}
            className="btn-secondary"
            title="Generar cuenta para el cliente"
          >
            🧾 Ver cuenta
          </button>

            {pedido.estado === 'abierto' && (
              <button onClick={enviarACocina} className="btn-primary" disabled={saving}>
                🔥 Enviar a cocina
              </button>
            )}
            {(isAdmin || user?.rol === 'cajero') && pedido.estado !== 'cerrado' && pedido.estado !== 'cancelado' && (
              <button onClick={() => setModalCobro(true)} className="btn-secondary">
                💳 Cobrar
              </button>
            )}
            {(isAdmin || pedido.items.length === 0) && pedido.estado !== 'cerrado' && pedido.estado !== 'cancelado' && (
              <button onClick={cancelar} className="btn-danger">Cancelar</button>
            )}
          </div>
        )}
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
              <h3 className="text-sm font-semibold text-gray-300">🛒 Por agregar</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {carrito.map(x => (
                  <div key={x.plato.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 bg-brand-500/20 text-brand-400 rounded text-xs flex items-center justify-center font-bold">
                      {x.cantidad}
                    </span>
                    <span className="flex-1 text-gray-200 truncate">{x.plato.nombre}</span>
                    <button onClick={() => quitarDelCarrito(x.plato.id)}
                      className="text-red-400 hover:text-red-300 text-lg leading-none">×</button>
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
                <h3 className="text-sm font-semibold text-gray-300">📋 Pedido actual</h3>
                <span className="text-xs text-gray-500">{fmtHora(pedido.hora_apertura)}</span>
              </div>
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
              <p className="text-3xl mb-2">🧾</p>
              <p className="text-sm">Selecciona platos para crear el pedido</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal cobro */}
      <Modal open={modalCobro} onClose={() => setModalCobro(false)} title="Cobrar pedido">
        {pedido && (
          <form onSubmit={cobrar} className="space-y-4">
            <div className="card p-3 bg-gray-800">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Subtotal</span><span>{fmt(pedido.total)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-100">
                <span>Total</span><span className="text-brand-400">{fmt(pedido.total - (Number(formCobro.descuento) || 0))}</span>
              </div>
            </div>
            <div>
              <label className="label">Descuento (S/.)</label>
              <input type="number" className="input" min={0} step={0.01}
                value={formCobro.descuento}
                onChange={e => setFormCobro(f => ({ ...f, descuento: e.target.value }))} />
            </div>
            <div>
              <label className="label">Método de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'efectivo', label: 'Efectivo' },
                  { value: 'tarjeta', label: 'Tarjeta' },
                  { value: 'yape', label: 'Yape' },
                  { value: 'plin', label: 'Plin' },
                  { value: 'transferencia', label: 'Transferencia' },
                ].map(m => (
                  <button key={m.value} type="button"
                    onClick={() => setFormCobro(f => ({ ...f, metodo_pago: m.value }))}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors
                      ${formCobro.metodo_pago === m.value
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-100'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? <Spinner size="sm" className="mx-auto" /> : '✅ Confirmar cobro'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setModalCobro(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}