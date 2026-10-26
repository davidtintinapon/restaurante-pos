import { useEffect, useState } from 'react'
import api from '../api'
import Spinner from '../components/ui/Spinner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

function StatCard({ label, value, sub, color = 'brand' }) {
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
          <p className="text-2xl sm:text-3xl font-bold text-gray-100 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-sm">
      <p className="text-gray-400">{label}</p>
      <p className="text-brand-400 font-semibold">S/. {payload[0].value.toFixed(2)}</p>
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [ventas, setVentas] = useState([])
  const [platos, setPlatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [stockBajo, setStockBajo] = useState([])

  useEffect(() => {
    const safe = (promise) => promise.catch(() => null)

    const cargar = () => Promise.all([
      api.get('/reportes/dashboard'),
      safe(api.get('/reportes/ventas_diarias?dias=7')),
      safe(api.get('/reportes/platos_populares?limite=5')),
      safe(api.get('/carta/stock_bajo?umbral=5')),
    ]).then(([s, v, p, sb]) => {
      if (s) setStats(s.data)
      if (v) setVentas(v.data)
      if (p) setPlatos(p.data)
      if (sb) setStockBajo(sb.data)
    }).finally(() => setLoading(false))

    cargar()
    const intervalo = setInterval(cargar, 30000)
    return () => clearInterval(intervalo)
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  )

  if (!stats) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-500">Error al cargar el dashboard. Recarga la página.</p>
    </div>
  )

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen de operaciones del día</p>
      </div>
      {stockBajo.length > 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-xl px-4 py-3">
          <p className="text-yellow-400 text-sm font-semibold mb-2">
            Stock bajo ({stockBajo.length} productos)
          </p>
          <div className="flex flex-wrap gap-2">
            {stockBajo.map(p => (
              <span key={p.id}
                className="text-xs bg-yellow-900/40 border border-yellow-700 text-yellow-300 px-2 py-1 rounded-md">
                {p.nombre} — {p.stock} uds
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Ventas hoy"
          value={`S/. ${stats.ventas_hoy.toFixed(2)}`}
          sub={`${stats.pedidos_hoy} pedidos cerrados`}
          color="brand"
        />
        <StatCard
          label="Ventas del mes"
          value={`S/. ${stats.ventas_mes.toFixed(2)}`}
          color="green"
        />
        <StatCard
          label="Pedidos activos"
          value={stats.pedidos_activos}
          sub="En curso ahora"
          color="blue"
        />
        <StatCard
          label="Mesas ocupadas"
          value={stats.mesas_ocupadas}
          sub={`Ticket prom. S/. ${stats.ticket_promedio}`}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-5 xl:col-span-2">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Ventas últimos 7 días</h3>
          {ventas.length === 0
            ? <p className="text-gray-500 text-sm">Sin datos aún</p>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={ventas} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `S/.${v}`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(249,115,22,0.08)' }} />
                  <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Top platos del mes</h3>
          <div className="space-y-3">
            {platos.length === 0 && <p className="text-gray-500 text-sm">Sin datos aún</p>}
            {platos.map((p, i) => (
              <div key={p.nombre} className="flex items-center gap-3">
                <span className="w-6 text-center text-gray-500 text-sm font-bold">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{p.nombre}</p>
                  <p className="text-xs text-gray-500">{p.unidades} unidades</p>
                </div>
                <span className="text-sm font-semibold text-brand-400 flex-shrink-0">
                  S/. {p.venta_total.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
