import { useEffect, useState } from 'react'
import api from '../api'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'

const PLANES = ['basico', 'estandar', 'pro']

function fmtFecha(dt) {
  if (!dt) return '—'
  const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z')
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' })
}

function diasRestantes(dt) {
  if (!dt) return null
  const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z')
  return Math.floor((d.getTime() - Date.now()) / 86400000)
}

export default function Superadmin() {
  const toast = useToast()
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal nuevo tenant
  const [modalTenant, setModalTenant] = useState(false)
  const [form, setForm] = useState({
    nombre: '', slug: '', plan: 'basico',
    max_usuarios: 10, max_mesas: 20,
    admin_nombre: '', admin_email: '', admin_password: '',
  })
  const [saving, setSaving] = useState(false)

  // Modal editar tenant
  const [modalEditar, setModalEditar] = useState(false)
  const [editTenant, setEditTenant] = useState(null)
  const [formEditar, setFormEditar] = useState({ ruc: '', direccion: '' })
  const [savingEditar, setSavingEditar] = useState(false)

  const cargar = () => {
    api.get('/superadmin/tenants').then(r => setTenants(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { cargar() }, [])

  const crearTenant = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/superadmin/tenants', form)
      toast('Restaurante creado ✅', 'success')
      setModalTenant(false)
      cargar()
    } catch (err) {
      toast(err.response?.data?.detail || 'Error', 'error')
    } finally { setSaving(false) }
  }

  const abrirEditar = t => {
    setEditTenant(t)
    setFormEditar({ ruc: t.ruc || '', direccion: t.direccion || '' })
    setModalEditar(true)
  }

  const guardarEditar = async e => {
    e.preventDefault()
    setSavingEditar(true)
    try {
      await api.patch(`/superadmin/tenants/${editTenant.id}`, formEditar)
      toast('Restaurante actualizado ✅', 'success')
      setModalEditar(false)
      cargar()
    } catch (err) {
      toast(err.response?.data?.detail || 'Error', 'error')
    } finally { setSavingEditar(false) }
  }

  const renovar = async (t, dias) => {
    await api.patch(`/superadmin/tenants/${t.id}/renovar?dias=${dias}`)
    toast(`Renovado ${dias} días`, 'success')
    cargar()
  }

  const suspender = async t => {
    if (!confirm(`¿Suspender "${t.nombre}"?`)) return
    await api.patch(`/superadmin/tenants/${t.id}/suspender`)
    toast('Suspendido', 'warn')
    cargar()
  }

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">⚙️ Superadmin</h1>
          <p className="text-gray-500 text-sm mt-0.5">{tenants.length} restaurantes en el sistema</p>
        </div>
        <button onClick={() => setModalTenant(true)} className="btn-primary">+ Nuevo restaurante</button>
      </div>

      {/* Tabla tenants */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              {['Restaurante', 'Plan', 'Estado', 'Vence', 'Días', 'Acciones'].map(h => (
                <th key={h} className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {tenants.map(t => {
              const dias = diasRestantes(t.vence_en)
              const urgente = dias !== null && dias <= 5
              return (
                <tr key={t.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-100">{t.nombre}</p>
                    <p className="text-xs text-gray-500">{t.slug}</p>
                    {t.ruc && <p className="text-xs text-gray-500">RUC: {t.ruc}</p>}
                    {t.direccion && <p className="text-xs text-gray-500 truncate max-w-[200px]">{t.direccion}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize text-sm text-gray-300">{t.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${t.activo ? 'bg-green-900/50 text-green-300 border border-green-800' : 'bg-red-900/50 text-red-300 border border-red-800'}`}>
                      {t.activo ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{fmtFecha(t.vence_en)}</td>
                  <td className="px-4 py-3">
                    {dias !== null && (
                      <span className={`text-sm font-semibold ${urgente ? 'text-red-400' : dias <= 10 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {dias > 0 ? `${dias}d` : 'Vencido'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => abrirEditar(t)} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">
                        ✏️
                      </button>
                      <button onClick={() => renovar(t, 30)} className="text-xs px-2 py-1 bg-green-900/40 hover:bg-green-800 text-green-300 rounded transition-colors">
                        +30d
                      </button>
                      {t.activo && (
                        <button onClick={() => suspender(t)} className="text-xs px-2 py-1 bg-red-900/40 hover:bg-red-800 text-red-300 rounded transition-colors">
                          Suspender
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {tenants.length === 0 && (
          <p className="text-gray-500 text-center py-10">Sin restaurantes registrados</p>
        )}
      </div>

      {/* Modal nuevo tenant */}
      <Modal open={modalTenant} onClose={() => setModalTenant(false)} title="Nuevo restaurante" size="lg">
        <form onSubmit={crearTenant} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre del restaurante *</label>
              <input className="input" value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required autoFocus />
            </div>
            <div>
              <label className="label">Slug (URL) *</label>
              <input className="input" value={form.slug} placeholder="mi-restaurante"
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Plan</label>
              <select className="input" value={form.plan}
                onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                {PLANES.map(p => <option key={p} value={p} className="bg-gray-800 capitalize">{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Máx. usuarios</label>
              <input type="number" className="input" min={1} value={form.max_usuarios}
                onChange={e => setForm(f => ({ ...f, max_usuarios: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">Máx. mesas</label>
              <input type="number" className="input" min={1} value={form.max_mesas}
                onChange={e => setForm(f => ({ ...f, max_mesas: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="border-t border-gray-800 pt-4">
            <p className="text-sm font-semibold text-gray-300 mb-3">Usuario admin del restaurante</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre admin *</label>
                <input className="input" value={form.admin_nombre}
                  onChange={e => setForm(f => ({ ...f, admin_nombre: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Email admin *</label>
                <input type="email" className="input" value={form.admin_email}
                  onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} required />
              </div>
            </div>
            <div className="mt-3">
              <label className="label">Contraseña admin *</label>
              <input type="password" className="input" value={form.admin_password}
                onChange={e => setForm(f => ({ ...f, admin_password: e.target.value }))} required placeholder="••••••••" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner size="sm" className="mx-auto" /> : 'Crear restaurante'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalTenant(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Modal editar tenant */}
      <Modal open={modalEditar} onClose={() => setModalEditar(false)} title={`Editar — ${editTenant?.nombre}`}>
        <form onSubmit={guardarEditar} className="space-y-4">
          <div>
            <label className="label">RUC</label>
            <input className="input" maxLength={11} placeholder="20123456789"
              value={formEditar.ruc}
              onChange={e => setFormEditar(f => ({ ...f, ruc: e.target.value }))} />
          </div>
          <div>
            <label className="label">Dirección</label>
            <input className="input" placeholder="Av. Principal 123, Lima"
              value={formEditar.direccion}
              onChange={e => setFormEditar(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={savingEditar}>
              {savingEditar ? <Spinner size="sm" className="mx-auto" /> : 'Guardar'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalEditar(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}