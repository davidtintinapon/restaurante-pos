import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import Spinner from '../components/ui/Spinner'
import Badge from '../components/ui/Badge'

function StatCard({ label, value, icon, sub, color = 'brand' }) {
  const colors = {
    brand:  'from-brand-600/20 to-brand-500/10 border-brand-700/50 text-brand-400',
    green:  'from-green-600/20 to-green-500/10 border-green-700/50 text-green-400',
    blue:   'from-blue-600/20 to-blue-500/10 border-blue-700/50 text-blue-400',
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

function fmtHora(dt) {
  if (!dt) return ''
  const d = new Date(dt.endsWith('Z') ? dt : dt + 'Z')
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' })
}

export default function DashboardCajero() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)

  const cargar = () => {
    Promise.all([
      api.get('/reportes/dashboard'),
      api.get('/pedidos/?estado='),
    ]).then(([s, p]) => {
      setStats(s.data)
      // Solo pedidos activos (no cerrados ni cancelados)
      setPedidos(p.data.filter(p => !['cerrado', 'cancelado'].includes(p.estado)))
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    const interval = setInterval(cargar, 6000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  // Desglose por método de pago del día
  const metodos = stats?.metodos_pago_hoy || {}

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Resumen del día</h1>
        <p className="text-gray-500 text-sm mt-1">Actualiza cada 6 seg</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Ingresos hoy"
          value={`S/. ${stats.ventas_hoy.toFixed(2)}`}
          icon="💰"
          sub={`${stats.pedidos_hoy} pedidos cobrados`}
          color="brand"
        />
        <StatCard
          label="Pedidos activos"
          value={stats.pedidos_activos}
          icon="🧾"
          sub="En curso ahora"
          color="blue"
        />
        <StatCard
          label="Mesas ocupadas"
          value={stats.mesas_ocupadas}
          icon="🪑"
          sub={`Ticket prom. S/. ${stats.ticket_promedio}`}
          color="purple"
        />
        <StatCard
          label="Ticket promedio"
          value={`S/. ${stats.ticket_promedio}`}
          icon="🧾"
          sub="Hoy"
          color="green"
        />
      </div>

      {/* Desglose métodos de pago */}
      {Object.keys(metodos).length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Ingresos por método de pago hoy</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(metodos).map(([metodo, total]) => (
              <div key={metodo} className="bg-gray-800/60 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 capitalize mb-1">{metodo}</p>
                <p className="text-lg font-bold text-gray-100">S/. {Number(total).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pedidos activos */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">
          Pedidos activos ({pedidos.length})
        </h3>
        {pedidos.length === 0 ? (
          <p className="text-gray-500 text-sm">Sin pedidos activos</p>
        ) : (
          <div className="space-y-2">
            {pedidos.map(p => (
              <div key={p.id}
                onClick={() => navigate(p.tipo === 'llevar' ? `/pedidos/${p.id}` : `/pedidos/mesa/${p.mesa_id}`)}
                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg
                           hover:bg-gray-800 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {p.tipo === 'llevar' ? '🥡' : '🪑'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-200">
                      {p.tipo === 'llevar' ? p.nombre_cliente : `Mesa ${p.numero_mesa}`}
                    </p>
                    <p className="text-xs text-gray-500">{fmtHora(p.hora_apertura)} · {p.nombre_mozo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge value={p.estado} />
                  <span className="text-sm font-bold text-brand-400">
                    S/. {Number(p.total).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}