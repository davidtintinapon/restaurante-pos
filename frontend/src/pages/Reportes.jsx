import { useEffect, useState } from 'react'
import api from '../api'
import Spinner from '../components/ui/Spinner'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend
} from 'recharts'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const PAGO_COLORS = {
  efectivo: '#f97316', tarjeta: '#3b82f6', yape: '#a855f7',
  plin: '#22c55e', transferencia: '#06b6d4', sin_definir: '#6b7280'
}
const PAGO_ICONS = {
  efectivo: '💵', tarjeta: '💳', yape: '📱',
  plin: '💚', transferencia: '🏦', sin_definir: '❓'
}

function fmt(n) { return `S/. ${Number(n || 0).toFixed(2)}` }

function fmtFechaLocal(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z')
  return d.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' })
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="card px-3 py-2 text-sm">
      <p className="text-gray-400">{label}</p>
      <p className="text-brand-400 font-semibold">{fmt(payload[0].value)}</p>
    </div>
  )
}

function exportarPDF(pedidos, fecha, cierre) {
  const doc = new jsPDF()
  const naranja = [249, 115, 22]
  const grisOscuro = [30, 30, 30]
  const grisClaro = [100, 100, 100]

  // ── Encabezado ──────────────────────────────────────────
  doc.setFillColor(...naranja)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('RestaurantePOS', 14, 12)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Reporte de cierre diario', 14, 20)
  doc.text(`Fecha: ${fecha}`, 196, 12, { align: 'right' })
  doc.text(`Generado: ${new Date().toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}`, 196, 20, { align: 'right' })

  // ── Resumen ──────────────────────────────────────────────
  doc.setTextColor(...grisOscuro)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen del día', 14, 38)

  const resumenData = [
    ['Pedidos cerrados', String(cierre?.total_pedidos ?? pedidos.length)],
    ['Total del día', `S/. ${(cierre?.total_general ?? pedidos.reduce((s,p)=>s+p.total,0)).toFixed(2)}`],
    ['Ticket promedio', `S/. ${(cierre?.ticket_promedio ?? (pedidos.length ? pedidos.reduce((s,p)=>s+p.total,0)/pedidos.length : 0)).toFixed(2)}`],
    ['Pedidos cancelados', String(cierre?.pedidos_cancelados ?? 0)],
  ]
  autoTable(doc, {
    startY: 42,
    body: resumenData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { textColor: grisClaro, cellWidth: 60 },
      1: { fontStyle: 'bold', textColor: grisOscuro },
    },
  })

  // ── Métodos de pago ──────────────────────────────────────
  const metodosPago = {}
  pedidos.forEach(p => {
    metodosPago[p.metodo_pago] = (metodosPago[p.metodo_pago] || 0) + p.total
  })

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...grisOscuro)
  const y1 = doc.lastAutoTable.finalY + 10
  doc.text('Desglose por método de pago', 14, y1)

  autoTable(doc, {
    startY: y1 + 4,
    head: [['Método', 'Pedidos', 'Total']],
    body: Object.entries(metodosPago).map(([m, t]) => [
      m.charAt(0).toUpperCase() + m.slice(1),
      String(pedidos.filter(p => p.metodo_pago === m).length),
      `S/. ${t.toFixed(2)}`,
    ]),
    headStyles: { fillColor: naranja, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { fontSize: 10 },
  })

  // ── Top mozos ────────────────────────────────────────────
  const mozos = {}
  pedidos.forEach(p => {
    if (!mozos[p.mozo]) mozos[p.mozo] = { pedidos: 0, total: 0 }
    mozos[p.mozo].pedidos++
    mozos[p.mozo].total += p.total
  })
  const topMozos = Object.entries(mozos).sort((a, b) => b[1].total - a[1].total)

  const y2 = doc.lastAutoTable.finalY + 10
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Rendimiento por mozo', 14, y2)

  autoTable(doc, {
    startY: y2 + 4,
    head: [['Mozo', 'Pedidos', 'Total vendido']],
    body: topMozos.map(([nombre, d]) => [
      nombre,
      String(d.pedidos),
      `S/. ${d.total.toFixed(2)}`,
    ]),
    headStyles: { fillColor: naranja, textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { fontSize: 10 },
  })

  // ── Detalle completo ─────────────────────────────────────
  const y3 = doc.lastAutoTable.finalY + 10
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Detalle de pedidos', 14, y3)

  autoTable(doc, {
    startY: y3 + 4,
    head: [['Apertura', 'Cierre', 'Mesa / Cliente', 'Mozo', 'Método', 'Total']],
    body: pedidos.map(p => [
      p.hora_apertura,
      p.hora_cierre,
      p.tipo === 'llevar' ? `🥡 ${p.nombre_cliente}` : `Mesa ${p.mesa}`,
      p.mozo,
      p.metodo_pago.charAt(0).toUpperCase() + p.metodo_pago.slice(1),
      `S/. ${p.total.toFixed(2)}`,
    ]),
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    styles: { fontSize: 9 },
    columnStyles: { 5: { fontStyle: 'bold', textColor: naranja } },
    foot: [[
      '', '', '', '', 'TOTAL',
      `S/. ${pedidos.reduce((s, p) => s + p.total, 0).toFixed(2)}`
    ]],
    footStyles: { fillColor: grisOscuro, textColor: 255, fontStyle: 'bold', fontSize: 10 },
  })

  // ── Pie ──────────────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(...grisClaro)
    doc.text(`Página ${i} de ${pageCount}`, 196, 290, { align: 'right' })
    doc.text('RestaurantePOS — reporte generado automáticamente', 14, 290)
  }

  doc.save(`reporte_${fecha}.pdf`)
}

export default function Reportes() {
  const hoyISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })

  const [tab, setTab] = useState('semana')
  const [tabMain, setTabMain] = useState('graficos') // 'graficos' | 'detalle'
  const [ventas7, setVentas7] = useState([])
  const [ventas30, setVentas30] = useState([])
  const [platos, setPlatos] = useState([])
  const [metodos, setMetodos] = useState([])
  const [cierre, setCierre] = useState(null)
  const [loading, setLoading] = useState(true)

  // Detalle pedidos
  const [fechaSel, setFechaSel] = useState(hoyISO)
  const [pedidosDia, setPedidosDia] = useState([])
  const [loadingDia, setLoadingDia] = useState(false)
  const [filtroPago, setFiltroPago] = useState('todos')
  const [rangoIni, setRangoIni] = useState('')
  const [rangoFin, setRangoFin] = useState('')
  const [ventasRango, setVentasRango] = useState([])
  const [loadingRango, setLoadingRango] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/reportes/ventas_diarias?dias=7'),
      api.get('/reportes/ventas_diarias?dias=30'),
      api.get('/reportes/platos_populares?limite=10'),
      api.get('/reportes/metodos_pago'),
      api.get('/reportes/cierre_diario'),
    ]).then(([v7, v30, p, m, c]) => {
      setVentas7(v7.data)
      setVentas30(v30.data)
      setPlatos(p.data)
      setMetodos(m.data)
      setCierre(c.data)
    }).finally(() => setLoading(false))
  }, [])

  const cargarDetalle = (fecha) => {
    setLoadingDia(true)
    api.get(`/reportes/pedidos_dia?fecha=${fecha}`)
      .then(r => setPedidosDia(r.data))
      .finally(() => setLoadingDia(false))
  }

  useEffect(() => {
    if (tabMain === 'detalle') cargarDetalle(fechaSel)
  }, [tabMain, fechaSel])

  const buscarRango = () => {
    if (!rangoIni || !rangoFin) return
    setLoadingRango(true)
    api.get(`/reportes/ventas_diarias?fecha_ini=${rangoIni}&fecha_fin=${rangoFin}`)
      .then(r => setVentasRango(r.data))
      .finally(() => setLoadingRango(false))
  }

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>

  const pedidosFiltrados = filtroPago === 'todos'
    ? pedidosDia
    : pedidosDia.filter(p => p.metodo_pago === filtroPago)

  const totalFiltrado = pedidosFiltrados.reduce((s, p) => s + p.total, 0)
  const metodosPago = ['todos', ...new Set(pedidosDia.map(p => p.metodo_pago))]

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Reportes</h1>
          <p className="text-gray-500 text-sm mt-0.5">Análisis y estadísticas del negocio</p>
        </div>
        {/* Tabs principales */}
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
          {[['graficos', '📊 Gráficos'], ['detalle', '📋 Detalle']].map(([key, label]) => (
            <button key={key} onClick={() => setTabMain(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                ${tabMain === key ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── PESTAÑA GRÁFICOS ── */}
      {tabMain === 'graficos' && (
        <>
          {/* Cierre del día */}
          {cierre && (
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-200 mb-4">
                📋 Cierre del día — {cierre.fecha}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  ['Pedidos cerrados', cierre.total_pedidos, '🧾'],
                  ['Total del día',    fmt(cierre.total_general), '💰'],
                  ['Ticket promedio',  fmt(cierre.ticket_promedio), '🎯'],
                  ['Cancelados',       cierre.pedidos_cancelados, '❌'],
                ].map(([label, value, icon]) => (
                  <div key={label} className="bg-gray-800/60 rounded-xl p-4 text-center">
                    <p className="text-2xl mb-1">{icon}</p>
                    <p className="text-xl font-bold text-gray-100">{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
              {Object.keys(cierre.por_metodo_pago).length > 0 && (
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-400 mb-3">Desglose por método de pago:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(cierre.por_metodo_pago).map(([m, t]) => (
                      <div key={m} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                        <span>{PAGO_ICONS[m] || '💳'}</span>
                        <span className="text-gray-400 capitalize text-sm">{m}</span>
                        <span className="text-gray-100 font-semibold text-sm">{fmt(t)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Gráfico ventas */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-base font-semibold text-gray-200">Ventas por día</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                  {[['semana', '7 días'], ['mes', '30 días'], ['rango', 'Rango']].map(([key, label]) => (
                    <button key={key} onClick={() => setTab(key)}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors
                        ${tab === key ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {tab === 'rango' && (
                  <div className="flex items-center gap-2">
                    <input type="date" value={rangoIni} max={hoyISO}
                      onChange={e => setRangoIni(e.target.value)}
                      className="input text-sm py-1 w-36" />
                    <span className="text-gray-500 text-sm">→</span>
                    <input type="date" value={rangoFin} max={hoyISO}
                      onChange={e => setRangoFin(e.target.value)}
                      className="input text-sm py-1 w-36" />
                    <button onClick={buscarRango} disabled={!rangoIni || !rangoFin || loadingRango}
                      className="btn-primary text-sm py-1 disabled:opacity-40">
                      {loadingRango ? <Spinner size="sm" /> : 'Ver'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={tab === 'semana' ? ventas7 : tab === 'mes' ? ventas30 : ventasRango}
                barSize={tab === 'semana' ? 32 : tab === 'rango' && ventasRango.length > 14 ? 8 : 14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="fecha" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `S/.${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(249,115,22,0.08)' }} />
                <Bar dataKey="total" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top platos */}
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-200 mb-4">🏆 Platos más pedidos del mes</h2>
              {platos.length === 0 && <p className="text-gray-500 text-sm">Sin datos</p>}
              <div className="space-y-3">
                {platos.map((p, i) => {
                  const maxUn = platos[0]?.unidades || 1
                  return (
                    <div key={p.nombre}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-200 truncate flex-1">
                          <span className="text-gray-500 font-bold mr-2">#{i + 1}</span>{p.nombre}
                        </span>
                        <div className="flex gap-3 flex-shrink-0">
                          <span className="text-gray-400">{p.unidades} uds</span>
                          <span className="text-brand-400 font-semibold">{fmt(p.venta_total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${(p.unidades / maxUn) * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Métodos de pago */}
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-200 mb-4">💳 Métodos de pago del mes</h2>
              {metodos.length === 0 && <p className="text-gray-500 text-sm">Sin datos</p>}
              {metodos.length > 0 && (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={metodos} dataKey="total" nameKey="metodo"
                        cx="50%" cy="50%" outerRadius={70} label={false}>
                        {metodos.map(m => (
                          <Cell key={m.metodo} fill={PAGO_COLORS[m.metodo] || '#6b7280'} />
                        ))}
                      </Pie>
                      <Legend formatter={v => <span className="text-gray-400 text-sm capitalize">{v}</span>} />
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {metodos.map(m => (
                      <div key={m.metodo} className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span>{PAGO_ICONS[m.metodo] || '💳'}</span>
                          <span className="capitalize text-gray-400">{m.metodo}</span>
                        </span>
                        <div className="flex gap-3">
                          <span className="text-gray-500">{m.cantidad} pedidos</span>
                          <span className="text-gray-100 font-semibold">{fmt(m.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── PESTAÑA DETALLE ── */}
      {tabMain === 'detalle' && (
        <div className="space-y-4">
          {/* Controles */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Fecha:</label>
              <input
                type="date"
                value={fechaSel}
                max={hoyISO}
                onChange={e => setFechaSel(e.target.value)}
                className="input text-sm py-1.5 w-40"
              />
            </div>
            <div className="flex gap-1 bg-gray-900 rounded-lg p-1 border border-gray-800">
              {metodosPago.map(m => (
                <button key={m} onClick={() => setFiltroPago(m)}
                  className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors
                    ${filtroPago === m ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-gray-100'}`}>
                  {m === 'todos' ? 'Todos' : (PAGO_ICONS[m] || '') + ' ' + m}
                </button>
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => exportarCSV(pedidosFiltrados, fechaSel)}
                disabled={pedidosFiltrados.length === 0}
                className="btn-secondary text-sm disabled:opacity-40">
                ⬇ CSV
              </button>
              <button
                onClick={() => exportarPDF(pedidosDia, fechaSel, cierre)}
                disabled={pedidosDia.length === 0}
                className="btn-primary text-sm disabled:opacity-40">
                📄 Exportar PDF
              </button>
            </div>
            </div>

          {/* Resumen rápido */}
          {pedidosDia.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-gray-100">{pedidosFiltrados.length}</p>
                <p className="text-xs text-gray-500 mt-1">Pedidos</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-brand-400">{fmt(totalFiltrado)}</p>
                <p className="text-xs text-gray-500 mt-1">Total</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-2xl font-bold text-gray-100">
                  {fmt(pedidosFiltrados.length ? totalFiltrado / pedidosFiltrados.length : 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Ticket promedio</p>
              </div>
            </div>
          )}

          {/* Tabla */}
          {loadingDia ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : pedidosFiltrados.length === 0 ? (
            <div className="card p-10 text-center text-gray-500">
              <p className="text-4xl mb-3">📭</p>
              <p>Sin pedidos para esta fecha{filtroPago !== 'todos' ? ` con método ${filtroPago}` : ''}</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Apertura</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Cierre</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Mesa / Cliente</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Mozo</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Método</th>
                    <th className="text-right px-4 py-3 text-gray-400 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosFiltrados.map((p, i) => (
                    <tr key={p.id}
                      className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors
                        ${i % 2 === 0 ? '' : 'bg-gray-800/10'}`}>
                      <td className="px-4 py-3 text-gray-300 font-mono">{p.hora_apertura}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono">{p.hora_cierre}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span>{p.tipo === 'llevar' ? '🥡' : '🪑'}</span>
                          <span className="text-gray-200">
                            {p.tipo === 'llevar' ? p.nombre_cliente : `Mesa ${p.mesa}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{p.mozo}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <span>{PAGO_ICONS[p.metodo_pago] || '💳'}</span>
                          <span className="capitalize text-gray-300">{p.metodo_pago}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-400">{fmt(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-700 bg-gray-800/40">
                    <td colSpan={5} className="px-4 py-3 text-gray-400 font-medium">
                      Total — {pedidosFiltrados.length} pedidos
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-100 text-base">
                      {fmt(totalFiltrado)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}