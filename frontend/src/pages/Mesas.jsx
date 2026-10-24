import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'

const ESTADOS = ['libre', 'ocupada', 'reservada', 'cuenta_pedida']

function MesaCard({ mesa, onSelect, isAdmin }) {
  const colores = {
    libre:         'border-green-700/50 hover:border-green-500',
    ocupada:       'border-red-700/50 hover:border-red-500',
    reservada:     'border-yellow-700/50 hover:border-yellow-500',
    cuenta_pedida: 'border-purple-700/50 hover:border-purple-500',
  }
  return (
    <div onClick={() => onSelect(mesa)}
      className={`card ${colores[mesa.estado]} border-2 p-4 cursor-pointer
                  transition-all duration-150 hover:scale-[1.02] hover:shadow-lg select-none`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-2xl font-bold text-gray-100">{mesa.numero}</p>
          {mesa.nombre && <p className="text-xs text-gray-500">{mesa.nombre}</p>}
        </div>
        <Badge value={mesa.estado} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{mesa.capacidad} personas</span>
        {mesa.zona && <span className="capitalize">{mesa.zona}</span>}
      </div>
    </div>
  )
}

function LlevarCard({ pedido, onClick }) {
  const colores = {
    abierto:   'border-blue-700/50 hover:border-blue-500',
    en_cocina: 'border-orange-700/50 hover:border-orange-500',
    listo:     'border-green-700/50 hover:border-green-500',
  }
  return (
    <div onClick={onClick}
      className={`card ${colores[pedido.estado] || 'border-gray-700'} border-2 p-4 cursor-pointer
                  transition-all duration-150 hover:scale-[1.02] hover:shadow-lg select-none`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-lg font-bold text-gray-100">{pedido.nombre_cliente}</p>
        <Badge value={pedido.estado} />
      </div>
      <p className="text-xs text-gray-500">{pedido.items.length} items · S/. {Number(pedido.total).toFixed(2)}</p>
      <p className="text-xs text-gray-500 mt-1">Mozo: {pedido.nombre_mozo}</p>
    </div>
  )
}

function DeliveryCard({ pedido, onClick }) {
  const colores = {
    abierto:   'border-blue-700/50 hover:border-blue-500',
    en_cocina: 'border-orange-700/50 hover:border-orange-500',
    listo:     'border-green-700/50 hover:border-green-500',
  }
  return (
    <div onClick={onClick}
      className={`card ${colores[pedido.estado] || 'border-gray-700'} border-2 p-4 cursor-pointer
                  transition-all duration-150 hover:scale-[1.02] hover:shadow-lg select-none`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-base font-bold text-gray-100">{pedido.nombre_cliente || pedido.telefono_delivery}</p>
        <Badge value={pedido.estado} />
      </div>
      {pedido.telefono_delivery && (
        <p className="text-xs text-gray-500">Tel: {pedido.telefono_delivery}</p>
      )}
      {pedido.direccion_delivery && (
        <p className="text-xs text-gray-500 truncate">Dir: {pedido.direccion_delivery}</p>
      )}
      <p className="text-xs text-gray-500 mt-1">{pedido.items.length} items · S/. {Number(pedido.total).toFixed(2)}</p>
    </div>
  )
}

export default function Mesas() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(() => {
    const t = searchParams.get('tab')
    return ['salon', 'llevar', 'delivery'].includes(t) ? t : 'salon'
  })  // 'salon' | 'llevar' | 'delivery'
  const [mesas, setMesas] = useState([])
  const [pedidosLlevar, setPedidosLlevar] = useState([])
  const [pedidosDelivery, setPedidosDelivery] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroZona, setFiltroZona] = useState('todas')
  const [filtroEstado, setFiltroEstado] = useState('todas')

  const [modalMesa, setModalMesa] = useState(false)
  const [editMesa, setEditMesa] = useState(null)
  const [formMesa, setFormMesa] = useState({ numero: '', nombre: '', capacidad: 4, zona: 'salon' })
  const [saving, setSaving] = useState(false)
  const [modalAccion, setModalAccion] = useState(null)
  const [modalLlevar, setModalLlevar] = useState(false)
  const [nombreCliente, setNombreCliente] = useState('')

  const [modalDelivery, setModalDelivery] = useState(false)
  const [formDelivery, setFormDelivery] = useState({ nombre_cliente: '', telefono: '', direccion: '' })
  const [savingDelivery, setSavingDelivery] = useState(false)

  const cargar = () => {
    Promise.all([
      api.get('/mesas/'),
      api.get('/pedidos/llevar/activos'),
      api.get('/pedidos/delivery/activos'),
    ]).then(([rMesas, rLlevar, rDelivery]) => {
      setMesas(rMesas.data)
      setPedidosLlevar(rLlevar.data)
      setPedidosDelivery(rDelivery.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 6000)
    return () => clearInterval(interval)
  }, [])

  const zonas = ['todas', ...new Set(mesas.map(m => m.zona).filter(Boolean))]
  const mesasFiltradas = mesas.filter(m => {
    if (filtroZona !== 'todas' && m.zona !== filtroZona) return false
    if (filtroEstado !== 'todas' && m.estado !== filtroEstado) return false
    return true
  })

  const handleSelectMesa = mesa => {
    if (mesa.estado === 'libre') {
      navigate(`/pedidos/nuevo?mesa_id=${mesa.id}&mesa_num=${mesa.numero}`)
    } else if (mesa.estado === 'ocupada') {
      navigate(`/pedidos/mesa/${mesa.id}`)
    } else {
      setModalAccion(mesa)
    }
  }

  const crearPedidoLlevar = async e => {
    e.preventDefault()
    if (!nombreCliente.trim()) return
    try {
      const res = await api.post('/pedidos/', {
        tipo: 'llevar',
        nombre_cliente: nombreCliente.trim(),
        items: [],
      })
      setModalLlevar(false)
      setNombreCliente('')
      navigate(`/pedidos/${res.data.id}`)
    } catch (err) {
      toast(err.response?.data?.detail || 'Error al crear pedido LLEVAR', 'error')
    }
  }

  const crearDelivery = async e => {
    e.preventDefault()
    if (!formDelivery.telefono || !formDelivery.direccion) {
      toast('Teléfono y dirección son obligatorios', 'error')
      return
    }
    setSavingDelivery(true)
    try {
      const res = await api.post('/pedidos/delivery', {
        nombre_cliente: formDelivery.nombre_cliente,
        telefono: formDelivery.telefono,
        direccion: formDelivery.direccion,
        items: [],
      })
      setModalDelivery(false)
      setFormDelivery({ nombre_cliente: '', telefono: '', direccion: '' })
      navigate(`/pedidos/${res.data.id}`)
    } catch (err) {
      toast(err.response?.data?.detail || 'Error al crear delivery', 'error')
    } finally { setSavingDelivery(false) }
  }

  const cambiarEstado = async (mesa, estado) => {
    try {
      await api.patch(`/mesas/${mesa.id}/estado`, { estado })
      toast(`Mesa ${mesa.numero} → ${estado}`, 'success')
      cargar()
    } catch { toast('Error al cambiar estado', 'error') }
    setModalAccion(null)
  }

  const abrirModalMesa = (mesa = null) => {
    setEditMesa(mesa)
    setFormMesa(mesa
      ? { numero: mesa.numero, nombre: mesa.nombre || '', capacidad: mesa.capacidad, zona: mesa.zona || 'salon' }
      : { numero: '', nombre: '', capacidad: 4, zona: 'salon' })
    setModalMesa(true)
  }

  const guardarMesa = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editMesa) {
        await api.patch(`/mesas/${editMesa.id}`, formMesa)
        toast('Mesa actualizada', 'success')
      } else {
        await api.post('/mesas/', { ...formMesa, numero: Number(formMesa.numero) })
        toast('Mesa creada', 'success')
      }
      setModalMesa(false)
      cargar()
    } catch (err) {
      toast(err.response?.data?.detail || 'Error', 'error')
    } finally { setSaving(false) }
  }

  const eliminarMesa = async mesa => {
    if (!confirm(`¿Eliminar la mesa ${mesa.numero}?`)) return
    await api.delete(`/mesas/${mesa.id}`)
    toast('Mesa eliminada', 'success')
    cargar()
  }

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-7xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            {tab === 'salon' ? 'Mapa de Mesas' : tab === 'llevar' ? 'Pedidos LLEVAR' : 'Deliveries'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {tab === 'salon'
              ? `${mesas.filter(m => m.estado === 'ocupada').length} ocupadas · ${mesas.filter(m => m.estado === 'libre').length} libres`
              : tab === 'llevar'
              ? `${pedidosLlevar.length} pedidos activos`
              : `${pedidosDelivery.length} deliveries activos`
            }
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'llevar' && (
            <button onClick={() => setModalLlevar(true)} className="btn-secondary">
              + Nuevo LLEVAR
            </button>
          )}
          {tab === 'delivery' && (
            <button onClick={() => setModalDelivery(true)} className="btn-secondary">
              + Nuevo Delivery
            </button>
          )}
          {isAdmin && tab === 'salon' && (
            <button onClick={() => abrirModalMesa()} className="btn-primary">+ Nueva mesa</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800 w-fit">
        <button onClick={() => setTab('salon')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
            ${tab === 'salon' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
          Salón
        </button>
        <button onClick={() => setTab('llevar')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2
            ${tab === 'llevar' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
          LLEVAR
          {pedidosLlevar.length > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {pedidosLlevar.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('delivery')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2
            ${tab === 'delivery' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
          Delivery
          {pedidosDelivery.length > 0 && (
            <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {pedidosDelivery.length}
            </span>
          )}
        </button>
      </div>

      {/* Vista Salón */}
      {tab === 'salon' && (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
              {zonas.map(z => (
                <button key={z} onClick={() => setFiltroZona(z)}
                  className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors
                    ${filtroZona === z ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
                  {z}
                </button>
              ))}
            </div>
            <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
              {['todas', ...ESTADOS].map(e => (
                <button key={e} onClick={() => setFiltroEstado(e)}
                  className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors
                    ${filtroEstado === e ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
                  {e === 'todas' ? 'Todas' : e.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {mesasFiltradas.map(mesa => (
              <div key={mesa.id} className="relative group">
                <MesaCard mesa={mesa} onSelect={handleSelectMesa} isAdmin={isAdmin} />
                {isAdmin && (
                  <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                    <button onClick={e => { e.stopPropagation(); abrirModalMesa(mesa) }}
                      className="w-7 h-7 bg-gray-700 hover:bg-gray-600 rounded-md text-xs transition-colors">Ed</button>
                    <button onClick={e => { e.stopPropagation(); eliminarMesa(mesa) }}
                      className="w-7 h-7 bg-red-900/60 hover:bg-red-800 rounded-md text-xs transition-colors">X</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {mesasFiltradas.length === 0 && (
            <div className="text-center py-20 text-gray-500">
              <p>No hay mesas con ese filtro</p>
            </div>
          )}
        </>
      )}

      {/* Vista LLEVAR */}
      {tab === 'llevar' && (
        <>
          {pedidosLlevar.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p>No hay pedidos LLEVAR activos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {pedidosLlevar.map(p => (
                <LlevarCard key={p.id} pedido={p} onClick={() => navigate(`/pedidos/${p.id}`)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Vista Delivery */}
      {tab === 'delivery' && (
        <>
          {pedidosDelivery.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <p>No hay deliveries activos</p>
              <button onClick={() => setModalDelivery(true)} className="btn-secondary mt-4">
                + Crear primer delivery
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {pedidosDelivery.map(p => (
                <DeliveryCard key={p.id} pedido={p} onClick={() => navigate(`/pedidos/${p.id}`)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal LLEVAR */}
      <Modal open={modalLlevar} onClose={() => setModalLlevar(false)} title="Nuevo pedido LLEVAR">
        <form onSubmit={crearPedidoLlevar} className="space-y-4">
          <div>
            <label className="label">Nombre del cliente *</label>
            <input type="text" className="input" placeholder="Ej: Juan García"
              value={nombreCliente} onChange={e => setNombreCliente(e.target.value)}
              autoFocus required />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1">Crear pedido</button>
            <button type="button" className="btn-secondary" onClick={() => setModalLlevar(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Modal Delivery */}
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
            <input className="input" placeholder="Ej: Av. Los Pinos 123"
              value={formDelivery.direccion}
              onChange={e => setFormDelivery(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          <p className="text-xs text-gray-500">
            Después de crear el delivery podrás agregar los platos.
          </p>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={savingDelivery}>
              {savingDelivery ? <Spinner size="sm" className="mx-auto" /> : 'Crear Delivery'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalDelivery(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Modal crear/editar mesa */}
      <Modal open={modalMesa} onClose={() => setModalMesa(false)} title={editMesa ? 'Editar mesa' : 'Nueva mesa'}>
        <form onSubmit={guardarMesa} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Número *</label>
              <input type="number" className="input" value={formMesa.numero} min={1}
                onChange={e => setFormMesa(f => ({ ...f, numero: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Capacidad</label>
              <input type="number" className="input" value={formMesa.capacidad} min={1} max={50}
                onChange={e => setFormMesa(f => ({ ...f, capacidad: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="label">Nombre / alias</label>
            <input type="text" className="input" placeholder="Terraza 1, VIP, etc."
              value={formMesa.nombre}
              onChange={e => setFormMesa(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="label">Zona</label>
            <select className="input" value={formMesa.zona}
              onChange={e => setFormMesa(f => ({ ...f, zona: e.target.value }))}>
              {['salon', 'terraza', 'barra', 'privado'].map(z => (
                <option key={z} value={z} className="bg-gray-800 capitalize">{z}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner size="sm" className="mx-auto" /> : (editMesa ? 'Guardar' : 'Crear mesa')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalMesa(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Modal acciones mesa especial */}
      <Modal open={!!modalAccion} onClose={() => setModalAccion(null)} title={`Mesa ${modalAccion?.numero}`}>
        {modalAccion && (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">Estado actual: <Badge value={modalAccion.estado} /></p>
            <p className="text-gray-400 text-sm">Cambiar a:</p>
            <div className="grid grid-cols-2 gap-2">
              {ESTADOS.filter(e => e !== modalAccion.estado).map(e => (
                <button key={e} onClick={() => cambiarEstado(modalAccion, e)}
                  className="btn-secondary capitalize">{e.replace('_', ' ')}</button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
