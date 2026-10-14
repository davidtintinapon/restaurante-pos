import { useEffect, useState } from 'react'
import api from '../api'
import Spinner from '../components/ui/Spinner'

function StatCard({ label, value, icon, sub, color = 'brand' }) {
  const colors = {
    brand:  'from-brand-600/20 to-brand-500/10 border-brand-700/50 text-brand-400',
    green:  'from-green-600/20 to-green-500/10 border-green-700/50 text-green-400',
    blue:   'from-blue-600/20 to-blue-500/10 border-blue-700/50 text-blue-400',
    red:    'from-red-600/20 to-red-500/10 border-red-700/50 text-red-400',
    purple: 'from-purple-600/20 to-purple-500/10 border-purple-700/50 text-purple-400',
  }
  return (
    <div className={`card bg-gradient-to-br ${colors[color]} p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm">{label}</p>
          <p className="text-3xl font-bold text-gray-100 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  )
}

const PLAN_BADGE = {
  basico:    'bg-gray-700 text-gray-300',
  estandar:  'bg-blue-900/50 text-blue-300',
  pro:       'bg-purple-900/50 text-purple-300',
}

const PLAN_PRECIO = { basico: 150, estandar: 250, pro: 400 }

export default function SuperadminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/superadmin/dashboard')
      .then(r => setData(r.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  const ahora = new Date()

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Panel de plataforma</h1>
        <p className="text-gray-500 text-sm mt-1">Vista global de todos los tenants</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Tenants activos"
          value={data.tenants_activos}
          icon="🏪"
          sub={`${data.tenants_total} en total`}
          color="green"
        />
        <StatCard
          label="Suspendidos"
          value={data.tenants_suspendidos}
          icon="⛔"
          color="red"
        />
        <StatCard
          label="Por vencer (7 días)"
          value={data.tenants_por_vencer}
          icon="⚠️"
          sub="Requieren renovación"
          color={data.tenants_por_vencer > 0 ? 'red' : 'blue'}
        />
        <StatCard
          label="Ingresos estimados"
          value={`S/. ${data.ingresos_mes_estimado}`}
          icon="💰"
          sub="Mes actual · tenants activos"
          color="brand"
        />
      </div>

      {/* Tabla tenants */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Tenants</h3>
          <span className="text-xs text-gray-500">{data.total_usuarios} usuarios registrados en total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-5 py-3 text-gray-400 font-medium">Restaurante</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Estado</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Vence</th>
                <th className="text-right px-5 py-3 text-gray-400 font-medium">S/. mes</th>
              </tr>
            </thead>
            <tbody>
              {data.tenants.map(t => {
                const vence = t.vence_en ? new Date(t.vence_en) : null
                const diasRestantes = vence ? Math.ceil((vence - ahora) / 86400000) : null
                const venceProximo = diasRestantes !== null && diasRestantes <= 7
                return (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-gray-100 font-medium">{t.nombre}</p>
                      <p className="text-xs text-gray-500">{t.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_BADGE[t.plan] || PLAN_BADGE.basico}`}>
                        {t.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.activo
                        ? <span className="text-xs text-green-400">● Activo</span>
                        : <span className="text-xs text-red-400">● Suspendido</span>}
                    </td>
                    <td className="px-4 py-3">
                      {vence ? (
                        <span className={`text-xs ${venceProximo ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                          {vence.toLocaleDateString('es-PE')}
                          {venceProximo && diasRestantes > 0 && ` (${diasRestantes}d)`}
                          {diasRestantes !== null && diasRestantes <= 0 && ' ⚠️ vencido'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-brand-400 font-semibold">
                      {t.activo ? `S/. ${PLAN_PRECIO[t.plan] || 150}` : <span className="text-gray-600">—</span>}
                    </td>
                  </tr>
                )
              })}
              {data.tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500 text-sm">
                    Sin tenants registrados aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
