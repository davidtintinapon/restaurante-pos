import { useEffect, useState, useCallback } from 'react'
import api from '../api'
import { useToast } from '../context/ToastContext'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'

function fmtHora(dt) {
  if (!dt) return ''
  const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z')
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })
}

function minutosDesde(dt) {
  if (!dt) return 0
  const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z')
  return Math.floor((Date.now() - d.getTime()) / 60000)
}

const NEXT_ESTADO = {
  pendiente: 'en_preparacion',
  en_preparacion: 'listo',
}

export default function Cocina() {
  const toast = useToast()
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null) // item_id siendo actualizado

  const cargar = useCallback(async () => {
    try {
      const r = await api.get('/cocina/pendientes')
      // Garantizar orden: más antiguo primero (backend ya lo envía así, esto es seguro adicional)
      const ordenados = [...r.data].sort((a, b) =>
        new Date(a.creado_en) - new Date(b.creado_en)
      )
      setPedidos(ordenados)
    } catch { /* silencioso */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    cargar()
    const timer = setInterval(cargar, 6_000)
    return () => clearInterval(timer)
  }, [cargar])

  const avanzarEstado = async (pedido_id, item_id, estado_actual) => {
    const siguiente = NEXT_ESTADO[estado_actual]
    if (!siguiente) return
    setUpdating(item_id)
    try {
      await api.patch(`/pedidos/${pedido_id}/items/${item_id}/estado`, { estado: siguiente })
      toast(siguiente === 'en_preparacion' ? 'En preparación' : '¡Listo!', 'success', 2000)
      // Actualizar solo el ítem afectado sin reordenar la lista
      setPedidos(prev => prev.map(p =>
        p.pedido_id !== pedido_id ? p : {
          ...p,
          items: p.items.map(i => i.id === item_id ? { ...i, estado: siguiente } : i)
        }
      ).filter(p => p.items.some(i => i.estado !== 'listo')))
    } catch { toast('Error', 'error') }
    setUpdating(null)
  }

  const marcarTodoListo = async pedido => {
    for (const item of pedido.items.filter(i => i.estado !== 'listo')) {
      await api.patch(`/pedidos/${pedido.pedido_id}/items/${item.id}/estado`, { estado: 'listo' })
    }
    toast('Todo marcado como listo', 'success')
    await cargar()
  }

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Vista de Cocina</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pedidos.length} pedidos pendientes · Actualiza cada 6 seg
          </p>
        </div>
        <button onClick={cargar} className="btn-secondary text-sm">Actualizar</button>
      </div>

      {pedidos.length === 0 && (
        <div className="text-center py-24 text-gray-500">
          <p className="text-5xl mb-4"></p>
          <p className="text-xl font-medium text-gray-400">Sin pedidos pendientes</p>
          <p className="text-sm mt-1">Todo está al día</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pedidos.map((pedido, idx) => {
          const mins = minutosDesde(pedido.creado_en)
          const urgente = mins >= 15
          const medio = mins >= 8 && mins < 15
          const ordenColor = idx === 0
            ? 'bg-brand-500 text-white'
            : idx === 1
            ? 'bg-gray-600 text-gray-200'
            : 'bg-gray-700 text-gray-400'

          return (
            <div key={pedido.pedido_id}
              className={`card border-2 flex flex-col
                ${urgente ? 'border-red-600 animate-pulse-border' : medio ? 'border-yellow-700' : 'border-gray-700'}`}>

              {/* Banda de orden de llegada */}
              <div className={`flex items-center justify-between px-4 py-1.5 text-xs font-bold
                ${idx === 0 ? 'bg-brand-500/20 border-b border-brand-500/40' : 'bg-gray-800/60 border-b border-gray-800'}`}>
                <span className={`flex items-center gap-1.5`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${ordenColor}`}>
                    {idx + 1}
                  </span>
                  <span className={idx === 0 ? 'text-brand-400' : 'text-gray-500'}>
                    {idx === 0 ? 'PRIMERO EN COLA' : `${idx + 1}° en cola`}
                  </span>
                </span>
                {pedido.numero_ticket && (
                  <span className="text-gray-500 font-mono">
                    Ticket #{String(pedido.numero_ticket).padStart(3, '0')}
                  </span>
                )}
              </div>

              {/* Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-800
                              ${urgente ? 'bg-red-900/20' : medio ? 'bg-yellow-900/10' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-black text-gray-100">
                    {pedido.tipo === 'llevar' || pedido.tipo === 'delivery' ? '' : `#${pedido.numero_mesa}`}
                  </span>
                  {pedido.tipo === 'llevar'
                    ? <span className="text-yellow-400 text-sm font-semibold">LLEVAR · {pedido.nombre_cliente || '—'}</span>
                    : pedido.tipo === 'delivery'
                    ? <span className="text-blue-400 text-sm font-semibold">DELIVERY · {pedido.nombre_cliente || '—'}</span>
                    : (
                      <div className="flex flex-col">
                        {pedido.zona_mesa && (
                          <span className="text-xs font-semibold uppercase tracking-wider text-brand-400/80">
                            {pedido.zona_mesa}
                          </span>
                        )}
                        {pedido.nombre_mesa && <span className="text-gray-500 text-sm">{pedido.nombre_mesa}</span>}
                      </div>
                    )
                  }
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${urgente ? 'text-red-400' : medio ? 'text-yellow-400' : 'text-gray-400'}`}>
                    {fmtHora(pedido.creado_en)} · {mins} min
                  </span>
                  {urgente && <span className="badge bg-red-900/60 text-red-300 border border-red-700">Urgente</span>}
                </div>
              </div>

              {/* Nota general */}
              {pedido.nota_general && (
                <div className="px-4 py-2 bg-yellow-900/20 border-b border-yellow-800/50">
                  <p className="text-xs text-yellow-300 font-medium"> {pedido.nota_general}</p>
                </div>
              )}

              {/* Items */}
              <div className="flex-1 p-4 space-y-3">
                {pedido.items.map(item => (
                  <div key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors
                      ${item.estado === 'en_preparacion'
                        ? 'bg-orange-900/20 border-orange-800'
                        : 'bg-gray-800/50 border-gray-700'}`}>
                    <span className="text-2xl font-black text-gray-100 w-8 text-center flex-shrink-0">
                      {item.cantidad}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-100">{item.nombre_plato}</p>
                      {item.nota && (
                        <p className="text-xs text-yellow-400 mt-0.5">Nota: {item.nota}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge value={item.estado} />
                      {NEXT_ESTADO[item.estado] && (
                        <button
                          onClick={() => avanzarEstado(pedido.pedido_id, item.id, item.estado)}
                          disabled={updating === item.id}
                          className={`text-xs px-2 py-1 rounded-md font-medium transition-colors
                            ${item.estado === 'pendiente'
                              ? 'bg-orange-600 hover:bg-orange-500 text-white'
                              : 'bg-green-600 hover:bg-green-500 text-white'}`}>
                          {updating === item.id
                            ? <Spinner size="sm" />
                            : item.estado === 'pendiente' ? 'Preparar' : 'Listo'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 pb-4">
                <button onClick={() => marcarTodoListo(pedido)}
                  className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-2 rounded-lg
                             transition-colors text-sm">
                      Todo listo
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}