import { useEffect, useState } from 'react'
import api from '../api'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'

const DEFAULTS = {
  nombre_restaurante: '',
  ruc: '',
  direccion: '',
  telefono: '',
  email: '',
  moneda: 'S/.',
  pie_ticket: '',
  igv_porcentaje: '18',
  mostrar_igv: false,
  printer_ip: '',
  printer_port: '9100',
}

function CambiarPassword() {
  const toast = useToast()
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.nueva !== form.confirmar) {
      toast.error('Las contraseñas nuevas no coinciden')
      return
    }
    if (form.nueva.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setSaving(true)
    try {
      await api.patch('/usuarios/me/password', {
        password_actual: form.actual,
        password_nueva: form.nueva,
      })
      toast.success('Contraseña actualizada')
      setForm({ actual: '', nueva: '', confirmar: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al cambiar contraseña')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <h2 className="text-lg font-semibold text-gray-200">Cambiar contraseña</h2>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Contraseña actual</label>
        <input
          type="password"
          className="input w-full"
          value={form.actual}
          onChange={e => setForm(p => ({ ...p, actual: e.target.value }))}
          required
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Nueva contraseña</label>
        <input
          type="password"
          className="input w-full"
          value={form.nueva}
          onChange={e => setForm(p => ({ ...p, nueva: e.target.value }))}
          required
          minLength={8}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-400 mb-1">Confirmar nueva contraseña</label>
        <input
          type="password"
          className="input w-full"
          value={form.confirmar}
          onChange={e => setForm(p => ({ ...p, confirmar: e.target.value }))}
          required
        />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? <Spinner size="sm" className="mx-auto" /> : 'Actualizar contraseña'}
      </button>
    </form>
  )
}


function GestionCajas() {
  const { user } = useAuth()
  const plan = user?.plan || 'basico'
  const [cajas, setCajas] = useState([])
  const [loading, setLoading] = useState(true)
  const [nueva, setNueva] = useState({ nombre: '', tipo: 'caja', printer_ip: '', printer_port: '9100' })
  const [editando, setEditando] = useState(null)
  const [saving, setSaving] = useState(false)
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false)
  const [limiteMsg, setLimiteMsg] = useState('')

  const cargar = () =>
    api.get('/cajas/').then(r => {
      setCajas(r.data)
      // En plan pro: si ya hay una caja de un tipo, preseleccionar el otro
      if (plan === 'pro') {
        const activas = r.data.filter(c => c.activo)
        const tieneCaja   = activas.some(c => c.tipo === 'caja')
        const tieneCocina = activas.some(c => c.tipo === 'cocina')
        if (tieneCocina && !tieneCaja)   setNueva(p => ({ ...p, tipo: 'caja' }))
        if (tieneCaja   && !tieneCocina) setNueva(p => ({ ...p, tipo: 'cocina' }))
      }
    }).finally(() => setLoading(false))

  useEffect(() => { cargar() }, [])

  const crear = async e => {
    e.preventDefault()
    if (!nueva.nombre.trim()) return
    setSaving(true)
    try {
      await api.post('/cajas/', {
        nombre: nueva.nombre.trim(),
        tipo: nueva.tipo,
        printer_ip: nueva.printer_ip.trim() || null,
        printer_port: nueva.printer_port || '9100',
      })
      setNueva({ nombre: '', tipo: 'caja', printer_ip: '', printer_port: '9100' })
      setLimiteAlcanzado(false)
      setLimiteMsg('')
      cargar()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Error al crear caja'
      if (err?.response?.status === 400) {
        setLimiteAlcanzado(true)
        setLimiteMsg(msg)
      }
    } finally { setSaving(false) }
  }

  const guardarEdicion = async e => {
    e.preventDefault()
    if (!editando?.nombre?.trim()) return
    setSaving(true)
    try {
      await api.patch(`/cajas/${editando.id}`, {
        nombre: editando.nombre.trim(),
        printer_ip: editando.printer_ip?.trim() || null,
        printer_port: editando.printer_port || '9100',
      })
      setEditando(null)
      cargar()
    } finally { setSaving(false) }
  }

  const eliminar = async id => {
    if (!confirm('¿Eliminar esta caja?')) return
    await api.delete(`/cajas/${id}`)
    cargar()
  }

  if (loading) return <div className="py-4 text-center text-gray-500 text-sm">Cargando cajas...</div>

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-1">Cajas / Impresoras</h3>
        <p className="text-xs text-gray-500">
          {plan === 'basico' && '📦 Plan Básico: 1 impresora total — elige si quieres ticket de cocina o de caja.'}
          {plan === 'pro' && '⭐ Plan Pro: hasta 2 impresoras — 1 de cocina y 1 de caja.'}
          {plan === 'premium' && '🚀 Plan Premium: impresoras ilimitadas.'}
        </p>
      </div>

      {/* Formulario nueva caja */}
      {(() => {
        const activas = cajas.filter(c => c.activo)
        const lleno =
          (plan === 'basico' && activas.length >= 1) ||
          (plan === 'pro' && activas.filter(c => c.tipo === 'cocina').length >= 1 && activas.filter(c => c.tipo === 'caja').length >= 1)
        if (lleno) return (
          <div className="px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
            {plan === 'basico'
              ? 'Has alcanzado el límite de tu plan Básico (1 impresora). Actualiza tu plan para agregar más.'
              : 'Has configurado 1 impresora de cocina y 1 de caja. Límite del Plan Pro alcanzado.'}
          </div>
        )
        return (
        <form onSubmit={crear} className="space-y-2 p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
          {limiteMsg && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {limiteMsg}
            </div>
          )}
          <p className="text-xs font-medium text-gray-400">Nueva caja</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="input"
              placeholder="Nombre (Ej: Caja 1, Cocina)"
              value={nueva.nombre}
              onChange={e => setNueva(p => ({ ...p, nombre: e.target.value }))}
              required
            />
            {(() => {
              const activas = cajas.filter(c => c.activo)
              const tieneCaja   = activas.some(c => c.tipo === 'caja')
              const tieneCocina = activas.some(c => c.tipo === 'cocina')
              // En pro: si un tipo ya está ocupado, forzar el otro
              if (plan === 'pro' && tieneCocina && !tieneCaja) {
                return <div className="input text-gray-300 flex items-center gap-2 cursor-default select-none">🧾 Caja (ticket con precios)</div>
              }
              if (plan === 'pro' && tieneCaja && !tieneCocina) {
                return <div className="input text-gray-300 flex items-center gap-2 cursor-default select-none">🍳 Cocina (ticket sin precios)</div>
              }
              return (
                <select
                  className="input"
                  value={nueva.tipo}
                  onChange={e => setNueva(p => ({ ...p, tipo: e.target.value }))}
                >
                  {(!tieneCaja   || plan !== 'pro') && <option value="caja">🧾 Caja (ticket con precios)</option>}
                  {(!tieneCocina || plan !== 'pro') && <option value="cocina">🍳 Cocina (ticket sin precios)</option>}
                </select>
              )
            })()}
            {plan === 'basico' && (
              <p className="text-xs text-yellow-400/80 sm:col-span-2">
                ⚠️ Plan Básico: solo puedes tener 1 impresora. Al elegir <strong>Cocina</strong> imprimirá cuando el mozo envíe el pedido. Al elegir <strong>Caja</strong> imprimirá cuando el cajero cobre.
              </p>
            )}
            {plan === 'pro' && nueva.tipo && cajas.filter(c => c.activo && c.tipo === nueva.tipo).length >= 1 && (
              <p className="text-xs text-yellow-400/80 sm:col-span-2">
                ⚠️ Ya tienes una impresora de {nueva.tipo === 'cocina' ? 'cocina' : 'caja'} configurada. El Plan Pro permite solo 1 por tipo.
              </p>
            )}
            <input
              className="input font-mono"
              placeholder="IP impresora (Ej: 192.168.1.100)"
              value={nueva.printer_ip}
              onChange={e => setNueva(p => ({ ...p, printer_ip: e.target.value }))}
            />
            <div className="flex gap-2">
              <input
                className="input font-mono w-24"
                placeholder="9100"
                value={nueva.printer_port}
                onChange={e => setNueva(p => ({ ...p, printer_port: e.target.value }))}
              />
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? '...' : 'Agregar'}
              </button>
            </div>
          </div>
        </form>
        )
      })()}

      {/* Lista de cajas */}
      {cajas.length === 0 ? (
        <p className="text-sm text-gray-600 py-2">No hay cajas creadas aún.</p>
      ) : (
        <div className="space-y-2">
          {cajas.map(c => (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-gray-800/40 border border-gray-700/40">
              {editando?.id === c.id ? (
                <form onSubmit={guardarEdicion} className="flex flex-col sm:flex-row gap-2 flex-1">
                  <input
                    className="input flex-1"
                    value={editando.nombre}
                    onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))}
                    required
                  />
                  <input
                    className="input font-mono flex-1"
                    placeholder="IP impresora"
                    value={editando.printer_ip || ''}
                    onChange={e => setEditando(p => ({ ...p, printer_ip: e.target.value }))}
                  />
                  <input
                    className="input font-mono w-20"
                    placeholder="9100"
                    value={editando.printer_port || '9100'}
                    onChange={e => setEditando(p => ({ ...p, printer_port: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary text-xs px-3" disabled={saving}>Guardar</button>
                    <button type="button" className="btn-ghost text-xs px-3" onClick={() => setEditando(null)}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-200">{c.nombre}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${c.tipo === 'cocina' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                        {c.tipo === 'cocina' ? '🍳 Cocina' : '🧾 Caja'}
                      </span>
                    </div>
                    {c.printer_ip ? (
                      <p className="text-xs text-gray-500 font-mono">{c.printer_ip}:{c.printer_port || '9100'}</p>
                    ) : (
                      <p className="text-xs text-gray-600 italic">Sin impresora configurada</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost text-xs px-3"
                      onClick={() => setEditando({ id: c.id, nombre: c.nombre, printer_ip: c.printer_ip || '', printer_port: c.printer_port || '9100' })}
                    >Editar</button>
                    <button
                      className="text-xs px-3 py-1 rounded-lg text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                      onClick={() => eliminar(c.id)}
                    >Eliminar</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GestionZonas() {
  const toast = useToast()
  const [zonas, setZonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [nueva, setNueva] = useState('')
  const [editando, setEditando] = useState(null) // { id, nombre }
  const [saving, setSaving] = useState(false)

  const cargar = () => {
    api.get('/zonas/').then(r => setZonas(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { cargar() }, [])

  const crear = async e => {
    e.preventDefault()
    if (!nueva.trim()) return
    setSaving(true)
    try {
      await api.post('/zonas/', { nombre: nueva.trim(), orden: zonas.length })
      setNueva('')
      cargar()
      toast('Zona creada', 'success')
    } catch (err) {
      toast(err.response?.data?.detail || 'Error al crear zona', 'error')
    } finally {
      setSaving(false)
    }
  }

  const guardarEdicion = async e => {
    e.preventDefault()
    if (!editando?.nombre.trim()) return
    setSaving(true)
    try {
      await api.patch(`/zonas/${editando.id}`, { nombre: editando.nombre.trim() })
      setEditando(null)
      cargar()
      toast('Zona actualizada', 'success')
    } catch (err) {
      toast(err.response?.data?.detail || 'Error al actualizar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async (id) => {
    try {
      await api.delete(`/zonas/${id}`)
      cargar()
      toast('Zona eliminada', 'success')
    } catch (err) {
      toast(err.response?.data?.detail || 'No se puede eliminar — tiene mesas asignadas', 'error')
    }
  }

  if (loading) return <div className="flex justify-center py-8"><Spinner size="lg" /></div>

  return (
    <div className="space-y-4">
      {/* Crear nueva zona */}
      <form onSubmit={crear} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Ej: Salón principal, Terraza, Barra…"
          value={nueva}
          onChange={e => setNueva(e.target.value)}
        />
        <button type="submit" className="btn-primary px-4" disabled={saving || !nueva.trim()}>
          {saving ? <Spinner size="sm" /> : 'Agregar'}
        </button>
      </form>

      {/* Lista de zonas */}
      {zonas.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No hay zonas creadas. Crea tu primera zona arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {zonas.map(z => (
            <li key={z.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700">
              {editando?.id === z.id ? (
                <form onSubmit={guardarEdicion} className="flex items-center gap-2 flex-1">
                  <input
                    className="input flex-1 py-1 text-sm"
                    value={editando.nombre}
                    onChange={e => setEditando(ed => ({ ...ed, nombre: e.target.value }))}
                    autoFocus
                  />
                  <button type="submit" className="text-xs text-green-400 hover:text-green-300 px-2" disabled={saving}>
                    Guardar
                  </button>
                  <button type="button" className="text-xs text-gray-500 hover:text-gray-300 px-1"
                    onClick={() => setEditando(null)}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-200 capitalize">{z.nombre}</span>
                  <button
                    type="button"
                    onClick={() => setEditando({ id: z.id, nombre: z.nombre })}
                    className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminar(z.id)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                  >
                    Eliminar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Configuracion() {
  const toast = useToast()
  const [tab, setTab] = useState('config')
  const [form, setForm] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/configuracion/').then(r => {
      setForm({ ...DEFAULTS, ...r.data })
    }).finally(() => setLoading(false))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const guardar = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/configuracion/', form)
      toast('Configuración guardada', 'success')
    } catch (err) {
      toast(err.response?.data?.detail || 'Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Configuración</h1>
        <p className="text-gray-500 text-sm mt-0.5">Datos del restaurante y opciones del ticket</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        <button
          type="button"
          onClick={() => setTab('config')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'config'
              ? 'bg-gray-800 text-gray-100 border border-b-0 border-gray-700'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Configuración
        </button>
        <button
          type="button"
          onClick={() => setTab('zonas')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'zonas'
              ? 'bg-gray-800 text-gray-100 border border-b-0 border-gray-700'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Zonas
        </button>
        <button
          type="button"
          onClick={() => setTab('cajas')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'cajas'
              ? 'bg-gray-800 text-gray-100 border border-b-0 border-gray-700'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Cajas
        </button>
        <button
          type="button"
          onClick={() => setTab('password')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            tab === 'password'
              ? 'bg-gray-800 text-gray-100 border border-b-0 border-gray-700'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Cambiar contraseña
        </button>
      </div>

      {tab === 'zonas' && (
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Zonas del restaurante</h2>
            <p className="text-xs text-gray-500 mt-1">Crea las zonas donde están tus mesas: Salón, Terraza, Barra, etc.</p>
          </div>
          <GestionZonas />
        </div>
      )}

      {tab === 'cajas' && (
        <div className="card p-5">
          <GestionCajas />
        </div>
      )}

      {tab === 'password' && (
        <div className="card p-5">
          <CambiarPassword />
        </div>
      )}

      {tab === 'config' && (
        <form onSubmit={guardar} className="space-y-6">
          {/* Datos del negocio */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Datos del negocio</h2>
            <div>
              <label className="label">Nombre del restaurante *</label>
              <input
                className="input"
                placeholder="Ej: Pollería El Sabrosón"
                value={form.nombre_restaurante}
                onChange={e => set('nombre_restaurante', e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">RUC</label>
                <input
                  className="input"
                  placeholder="20123456789"
                  value={form.ruc}
                  onChange={e => set('ruc', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Teléfono</label>
                <input
                  className="input"
                  placeholder="044-123456"
                  value={form.telefono}
                  onChange={e => set('telefono', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Dirección</label>
              <input
                className="input"
                placeholder="Av. Principal 123, Guadalupe"
                value={form.direccion}
                onChange={e => set('direccion', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                placeholder="contacto@restaurante.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>
          </div>

          {/* Ticket y facturación */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Ticket y facturación</h2>
            <div>
              <label className="label">Moneda</label>
              <div className="flex gap-2">
                {['S/.', '$', '€'].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set('moneda', m)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.moneda === m
                        ? 'bg-brand-500 border-brand-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Pie de ticket</label>
              <input
                className="input"
                placeholder="Ej: ¡Gracias por su visita! Vuelva pronto."
                value={form.pie_ticket}
                onChange={e => set('pie_ticket', e.target.value)}
              />
              <p className="text-xs text-gray-600 mt-1">Texto que aparece al final del ticket PDF</p>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-gray-800">
              <div>
                <p className="text-sm text-gray-300">Mostrar IGV en ticket</p>
                <p className="text-xs text-gray-600">Desglosa el IGV ({form.igv_porcentaje}%) en el ticket</p>
              </div>
              <button
                type="button"
                onClick={() => set('mostrar_igv', !form.mostrar_igv)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                  form.mostrar_igv ? 'bg-brand-500' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    form.mostrar_igv ? 'translate-x-[18px]' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            {form.mostrar_igv && (
              <div>
                <label className="label">% IGV</label>
                <input
                  className="input w-24"
                  type="number"
                  min={0}
                  max={30}
                  value={form.igv_porcentaje}
                  onChange={e => set('igv_porcentaje', e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Impresora térmica */}
          <div className="card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Impresoras de cocina</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Gestiona tus cajas e impresoras térmicas desde la pestaña <strong className="text-gray-400">Cajas</strong>.
                Puedes configurar una IP por caja según tu plan.
              </p>
            </div>
          </div>

          {/* Preview ticket */}
          <div className="card p-5 space-y-2 border-dashed">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Preview del ticket</h2>
            <div className="bg-white text-gray-900 rounded-lg p-4 font-mono text-xs space-y-1 max-w-xs mx-auto">
              <p className="text-center font-bold text-sm">{form.nombre_restaurante || 'NOMBRE RESTAURANTE'}</p>
              {form.ruc && <p className="text-center">RUC: {form.ruc}</p>}
              {form.direccion && <p className="text-center text-gray-600">{form.direccion}</p>}
              {form.telefono && <p className="text-center text-gray-600">Tel: {form.telefono}</p>}
              <p className="text-center text-gray-400">─────────────────</p>
              <p className="text-center">Cuenta de consumo</p>
              <p className="text-center text-gray-400">─────────────────</p>
              <div className="flex justify-between"><span>2× Lomo Saltado</span><span>{form.moneda} 36.00</span></div>
              <div className="flex justify-between"><span>1× Inca Kola</span><span>{form.moneda} 5.00</span></div>
              <p className="text-center text-gray-400">─────────────────</p>
              {form.mostrar_igv && (
                <>
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span><span>{form.moneda} 34.75</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>IGV ({form.igv_porcentaje}%)</span><span>{form.moneda} 6.25</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold"><span>TOTAL</span><span>{form.moneda} 41.00</span></div>
              <p className="text-center text-gray-400">─────────────────</p>
              <p className="text-center text-gray-500">{form.pie_ticket || '¡Gracias por su visita!'}</p>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? <Spinner size="sm" className="mx-auto" /> : 'Guardar configuración'}
          </button>
        </form>
      )}
    </div>
  )
}
