import { useEffect, useState } from 'react'
import api from '../api'
import Spinner from '../components/ui/Spinner'
import { useAuth } from '../context/AuthContext'

const CATEGORIA_LABELS = {
  insumos:      { label: 'Insumos',      color: 'bg-orange-500/20 text-orange-400' },
  servicios:    { label: 'Servicios',    color: 'bg-blue-500/20 text-blue-400' },
  personal:     { label: 'Personal',     color: 'bg-purple-500/20 text-purple-400' },
  mantenimiento:{ label: 'Mantenimiento',color: 'bg-yellow-500/20 text-yellow-400' },
  otros:        { label: 'Otros',        color: 'bg-gray-500/20 text-gray-400' },
}

function fmt(n) { return `S/. ${Number(n || 0).toFixed(2)}` }

export default function GastosCaja() {
  const { user } = useAuth()
  const esAdmin = ['admin', 'superadmin'].includes(user?.rol)

  const [gastos, setGastos] = useState([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ descripcion: '', monto: '', categoria: 'otros' })

  const hoyISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

  async function cargar() {
    try {
      setLoading(true)
      const { data } = await api.get('/gastos/')
      setGastos(data)
    } catch {
      setError('No se pudieron cargar los gastos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.descripcion.trim()) return setError('La descripción es obligatoria')
    if (!form.monto || Number(form.monto) <= 0) return setError('El monto debe ser mayor a 0')

    setEnviando(true)
    try {
      await api.post('/gastos/', {
        descripcion: form.descripcion.trim(),
        monto: Number(form.monto),
        categoria: form.categoria,
      })
      setForm({ descripcion: '', monto: '', categoria: 'otros' })
      await cargar()
    } catch (err) {
      setError(err?.response?.data?.detail || 'Error al registrar el gasto')
    } finally {
      setEnviando(false)
    }
  }

  async function handleEliminar(id) {
    if (!confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`/gastos/${id}`)
      await cargar()
    } catch {
      setError('No se pudo eliminar el gasto')
    }
  }

  const totalGastos = gastos.reduce((s, g) => s + g.monto, 0)

  return (
    <div className="max-w-3xl w-full space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Gastos de caja</h1>
        <p className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString('es-PE', {
            timeZone: 'America/Lima',
            weekday: 'long', day: 'numeric', month: 'long'
          })}
        </p>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Registrar gasto</h2>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Descripción */}
          <div className="sm:col-span-2">
            <label className="block text-xs text-gray-400 mb-1">Descripción</label>
            <input
              type="text"
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ej: Compra de aceite vegetal"
              className="input w-full"
              maxLength={200}
            />
          </div>

          {/* Monto */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Monto (S/.)</label>
            <input
              type="number"
              value={form.monto}
              onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              className="input w-full"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">Categoría</label>
            <select
              value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              className="input w-full"
            >
              {Object.entries(CATEGORIA_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="btn-primary w-full sm:w-auto"
        >
          {enviando ? 'Registrando…' : 'Registrar gasto'}
        </button>
      </form>

      {/* Resumen del día */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Gastos del día</h2>
          <span className="text-lg font-bold text-red-400">{fmt(totalGastos)}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : gastos.length === 0 ? (
          <p className="text-center text-gray-500 py-8 text-sm">No hay gastos registrados hoy</p>
        ) : (
          <div className="space-y-2">
            {gastos.map(g => (
              <div
                key={g.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
              >
                {/* Categoría badge */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${CATEGORIA_LABELS[g.categoria]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                  {CATEGORIA_LABELS[g.categoria]?.label || g.categoria}
                </span>

                {/* Descripción */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{g.descripcion}</p>
                  <p className="text-xs text-gray-500">
                    {g.hora} · {g.registrado_por}
                  </p>
                </div>

                {/* Monto */}
                <span className="text-sm font-semibold text-red-400 flex-shrink-0">
                  -{fmt(g.monto)}
                </span>

                {/* Eliminar (solo admin) */}
                {esAdmin && (
                  <button
                    onClick={() => handleEliminar(g.id)}
                    className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 ml-1 text-xs"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            ))}

            {/* Total */}
            <div className="flex justify-end pt-2 border-t border-gray-700/50">
              <span className="text-sm text-gray-400 mr-3">Total gastos:</span>
              <span className="text-sm font-bold text-red-400">{fmt(totalGastos)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
