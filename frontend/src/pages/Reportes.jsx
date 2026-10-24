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

const CATEGORIA_LABELS = {
  insumos:      'Insumos',
  servicios:    'Servicios',
  personal:     'Personal',
  mantenimiento:'Mantenimiento',
  otros:        'Otros',
}

function fmt(n) { return `S/. ${Number(n || 0).toFixed(2)}` }
function fmtTicket(n) { return n ? `#${String(n).padStart(3, '0')}` : '—' }

function fmtFechaLocal(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z')
  return d.toLocaleDateString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtHora12(timeStr) {
  if (!timeStr) return '—'
  // Acepta "19:17", "19:17:00", o "13/10 19:17" (formato rango)
  const partes = timeStr.split(' ')
  const soloHora = partes.length === 2 ? partes[1] : partes[0]
  const [h, m] = soloHora.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return timeStr
  const periodo = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${periodo}`
}

function fmtFechaHora12(timeStr) {
  // Para el PDF de rango: muestra "13/10 7:17 PM"
  if (!timeStr) return '—'
  const partes = timeStr.split(' ')
  if (partes.length === 2) {
    return `${partes[0]} ${fmtHora12(timeStr)}`
  }
  return fmtHora12(timeStr)
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

  // ── Paleta ──────────────────────────────────────────────
  const naranja  = [249, 115, 22]
  const naranjaL = [254, 215, 170]
  const rojo     = [220, 38, 38]
  const rojoL    = [254, 226, 226]
  const verde    = [22, 163, 74]
  const azul     = [37, 99, 235]
  const gris900  = [17, 24, 39]
  const gris700  = [55, 65, 81]
  const gris400  = [156, 163, 175]
  const gris100  = [243, 244, 246]
  const blanco   = [255, 255, 255]

  const hora = new Date().toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit'
  })

  // ════════════════════════════════════════════════════════
  // ENCABEZADO — banda naranja con acento inferior
  // ════════════════════════════════════════════════════════
  doc.setFillColor(...naranja)
  doc.rect(0, 0, 210, 32, 'F')
  doc.setFillColor(200, 85, 10)
  doc.rect(0, 30, 210, 2, 'F')

  doc.setTextColor(...blanco)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('RestaurantePOS', 14, 14)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('REPORTE DE CIERRE DIARIO', 14, 22)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(fecha, 196, 13, { align: 'right' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generado: ${hora}`, 196, 21, { align: 'right' })

  // ════════════════════════════════════════════════════════
  // KPI CARDS — 3 columnas x 2 filas
  // ════════════════════════════════════════════════════════
  const totalVentas = cierre?.total_general ?? pedidos.reduce((s, p) => s + p.total, 0)
  const totalGastos = cierre?.total_gastos ?? 0
  const cajaNeta    = cierre?.caja_neta ?? totalVentas
  const ticketProm  = cierre?.ticket_promedio ?? (pedidos.length ? totalVentas / pedidos.length : 0)

  const kpis = [
    { label: 'Pedidos cerrados',   valor: String(cierre?.total_pedidos ?? pedidos.length), color: azul,    bg: [219,234,254] },
    { label: 'Total del dia',      valor: `S/. ${totalVentas.toFixed(2)}`,                 color: naranja, bg: naranjaL },
    { label: 'Ticket promedio',    valor: `S/. ${ticketProm.toFixed(2)}`,                  color: azul,    bg: [219,234,254] },
    { label: 'Pedidos cancelados', valor: String(cierre?.pedidos_cancelados ?? 0),         color: rojo,    bg: rojoL },
    { label: 'Total gastos',       valor: `S/. ${totalGastos.toFixed(2)}`,                 color: rojo,    bg: rojoL },
    { label: 'Caja neta',          valor: `S/. ${cajaNeta.toFixed(2)}`,                    color: verde,   bg: [187,247,208] },
  ]

  const cardW = 57, cardH = 18, cardGap = 5
  const cardX0 = 14, cardY0 = 40

  kpis.forEach((k, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = cardX0 + col * (cardW + cardGap)
    const y = cardY0 + row * (cardH + 4)

    doc.setFillColor(...k.bg)
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F')
    doc.setFillColor(...k.color)
    doc.rect(x, y, 3, cardH, 'F')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...gris700)
    doc.text(k.label.toUpperCase(), x + 6, y + 6)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...k.color)
    doc.text(k.valor, x + 6, y + 14)
  })

  // ════════════════════════════════════════════════════════
  // HELPER: título de sección con acento naranja
  // ════════════════════════════════════════════════════════
  function seccion(titulo, y, color = gris900) {
    doc.setFillColor(...naranja)
    doc.rect(14, y - 4, 3, 7, 'F')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...color)
    doc.text(titulo, 20, y)
  }

  let yCurrent = cardY0 + 2 * (cardH + 4) + 12

  // ════════════════════════════════════════════════════════
  // MÉTODOS DE PAGO  /  RENDIMIENTO POR MOZO — lado a lado
  // ════════════════════════════════════════════════════════
  seccion('Metodos de pago  /  Rendimiento por mozo', yCurrent)

  const metodosPago = {}
  pedidos.forEach(p => {
    if (!metodosPago[p.metodo_pago]) metodosPago[p.metodo_pago] = { pedidos: 0, total: 0 }
    metodosPago[p.metodo_pago].pedidos++
    metodosPago[p.metodo_pago].total += p.total
  })

  autoTable(doc, {
    startY: yCurrent + 4,
    tableWidth: 85,
    margin: { left: 14 },
    head: [['Metodo', 'Pedidos', 'Total']],
    body: Object.entries(metodosPago).map(([m, d]) => [
      m.charAt(0).toUpperCase() + m.slice(1),
      String(d.pedidos),
      `S/. ${d.total.toFixed(2)}`,
    ]),
    headStyles: { fillColor: naranja, textColor: blanco, fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: gris100 },
    styles: { lineColor: [229,231,235], lineWidth: 0.1 },
  })
  const yDespuesMet = doc.lastAutoTable.finalY

  const mozos = {}
  pedidos.forEach(p => {
    if (!mozos[p.mozo]) mozos[p.mozo] = { pedidos: 0, total: 0 }
    mozos[p.mozo].pedidos++
    mozos[p.mozo].total += p.total
  })
  const topMozos = Object.entries(mozos).sort((a, b) => b[1].total - a[1].total)

  autoTable(doc, {
    startY: yCurrent + 4,
    tableWidth: 85,
    margin: { left: 111 },
    head: [['Mozo', 'Pedidos', 'Total']],
    body: topMozos.map(([nombre, d]) => [
      nombre,
      String(d.pedidos),
      `S/. ${d.total.toFixed(2)}`,
    ]),
    headStyles: { fillColor: gris900, textColor: blanco, fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: gris100 },
    styles: { lineColor: [229,231,235], lineWidth: 0.1 },
  })
  const yDespuesMoz = doc.lastAutoTable.finalY

  yCurrent = Math.max(yDespuesMet, yDespuesMoz) + 12

  // ════════════════════════════════════════════════════════
  // GASTOS DEL DÍA
  // ════════════════════════════════════════════════════════
  if (cierre?.detalle_gastos?.length > 0) {
    seccion('Gastos del dia', yCurrent, rojo)

    autoTable(doc, {
      startY: yCurrent + 4,
      head: [['Hora', 'Descripcion', 'Categoria', 'Registrado por', 'Monto']],
      body: cierre.detalle_gastos.map(g => [
        fmtHora12(g.hora),
        g.descripcion,
        CATEGORIA_LABELS[g.categoria] || g.categoria,
        g.registrado_por,
        `S/. ${Number(g.monto).toFixed(2)}`,
      ]),
      headStyles: { fillColor: rojo, textColor: blanco, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: rojoL },
      styles: { lineColor: [254,202,202], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 22 },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    })

    const yTG = doc.lastAutoTable.finalY + 1
    doc.setFillColor(...rojo)
    doc.rect(14, yTG, 182, 8, 'F')
    doc.setTextColor(...blanco)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL GASTOS', 140, yTG + 5.5)
    doc.text(`S/. ${totalGastos.toFixed(2)}`, 192, yTG + 5.5, { align: 'right' })
    yCurrent = yTG + 8 + 12
  }

  // ════════════════════════════════════════════════════════
  // DETALLE DE PEDIDOS
  // ════════════════════════════════════════════════════════
  seccion('Detalle de pedidos', yCurrent)

  autoTable(doc, {
    startY: yCurrent + 4,
    head: [['#', 'Apertura', 'Cierre', 'Mesa / Cliente', 'Mozo', 'Metodo', 'Total']],
    body: pedidos.map(p => [
      p.numero_ticket ? `#${String(p.numero_ticket).padStart(3, '0')}` : '—',
      fmtHora12(p.hora_apertura),
      fmtHora12(p.hora_cierre),
      p.tipo === 'llevar'
        ? `Llevar · ${p.nombre_cliente || ''}`
        : p.tipo === 'delivery'
        ? `Delivery · ${p.nombre_cliente || ''}`
        : `Mesa ${p.mesa}`,
      p.mozo,
      p.metodo_pago.charAt(0).toUpperCase() + p.metodo_pago.slice(1),
      `S/. ${p.total.toFixed(2)}`,
    ]),
    headStyles: { fillColor: gris900, textColor: blanco, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 8, cellPadding: 3 },
    alternateRowStyles: { fillColor: gris100 },
    styles: { lineColor: [229,231,235], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center', fontStyle: 'bold', textColor: naranja },
      1: { cellWidth: 20 },
      2: { cellWidth: 20 },
      6: { halign: 'right', fontStyle: 'bold' },
    },
  })

  const yTP = doc.lastAutoTable.finalY + 1
  doc.setFillColor(...gris900)
  doc.rect(14, yTP, 182, 9, 'F')
  doc.setTextColor(...blanco)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL DEL DIA', 18, yTP + 6)
  doc.text(`S/. ${totalVentas.toFixed(2)}`, 192, yTP + 6, { align: 'right' })
  yCurrent = yTP + 9 + 12

  // ════════════════════════════════════════════════════════
  // CAJA NETA — bloque final llamativo
  // ════════════════════════════════════════════════════════
  if (yCurrent + 26 > 275) { doc.addPage(); yCurrent = 20 }

  const colorCaja = cajaNeta >= 0 ? verde : rojo
  doc.setFillColor(200, 200, 200)
  doc.roundedRect(15.5, yCurrent + 1.5, 182, 24, 3, 3, 'F')
  doc.setFillColor(...colorCaja)
  doc.roundedRect(14, yCurrent, 182, 24, 3, 3, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...blanco)
  doc.text('RESULTADO DEL DIA', 20, yCurrent + 9)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('CAJA NETA', 20, yCurrent + 19)
  doc.setFontSize(18)
  doc.text(`S/. ${cajaNeta.toFixed(2)}`, 192, yCurrent + 19, { align: 'right' })

  // ════════════════════════════════════════════════════════
  // PIE DE PÁGINA — todas las páginas
  // ════════════════════════════════════════════════════════
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(...gris400)
    doc.setLineWidth(0.3)
    doc.line(14, 285, 196, 285)
    doc.setFontSize(7.5)
    doc.setTextColor(...gris400)
    doc.setFont('helvetica', 'normal')
    doc.text('RestaurantePOS  ·  Reporte generado automaticamente', 14, 290)
    doc.setFont('helvetica', 'bold')
    doc.text(`Pagina ${i} / ${pageCount}`, 196, 290, { align: 'right' })
  }

  doc.save(`reporte_${fecha}.pdf`)
}

function exportarPDFRango(rango) {
  if (!rango) return
  const doc = new jsPDF()

  // ── Paleta de colores ────────────────────────────────────
  const naranja   = [249, 115, 22]
  const naranjaL  = [254, 215, 170]   // naranja claro para fondos
  const rojo      = [220, 38, 38]
  const rojoL     = [254, 226, 226]
  const verde     = [22, 163, 74]
  const azul      = [37, 99, 235]
  const gris900   = [17, 24, 39]
  const gris700   = [55, 65, 81]
  const gris400   = [156, 163, 175]
  const gris100   = [243, 244, 246]
  const blanco    = [255, 255, 255]
  const amarillo  = [234, 179, 8]

  const hora = new Date().toLocaleTimeString('es-PE', {
    timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit'
  })

  // ════════════════════════════════════════════════════════
  // ENCABEZADO — banda naranja con acento inferior
  // ════════════════════════════════════════════════════════
  doc.setFillColor(...naranja)
  doc.rect(0, 0, 210, 32, 'F')
  // acento inferior más oscuro
  doc.setFillColor(200, 85, 10)
  doc.rect(0, 30, 210, 2, 'F')

  // Logo / nombre
  doc.setTextColor(...blanco)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('RestaurantePOS', 14, 14)

  // Subtítulo
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('REPORTE POR PERIODO', 14, 22)

  // Metadatos a la derecha
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`${rango.fecha_ini}  —  ${rango.fecha_fin}`, 196, 13, { align: 'right' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`${rango.dias} dias  ·  Generado: ${hora}`, 196, 21, { align: 'right' })

  // ════════════════════════════════════════════════════════
  // KPI CARDS — 3 columnas x 2 filas
  // ════════════════════════════════════════════════════════
  const kpis = [
    { label: 'Pedidos cerrados',   valor: String(rango.total_pedidos),                color: azul,    bg: [219,234,254] },
    { label: 'Total ventas',       valor: `S/. ${rango.total_ventas.toFixed(2)}`,      color: naranja, bg: naranjaL },
    { label: 'Ticket promedio',    valor: `S/. ${rango.ticket_promedio.toFixed(2)}`,   color: azul,    bg: [219,234,254] },
    { label: 'Pedidos cancelados', valor: String(rango.pedidos_cancelados),            color: rojo,    bg: rojoL },
    { label: 'Total gastos',       valor: `S/. ${rango.total_gastos.toFixed(2)}`,      color: rojo,    bg: rojoL },
    { label: 'Caja neta',          valor: `S/. ${rango.caja_neta.toFixed(2)}`,         color: verde,   bg: [187,247,208] },
  ]

  const cardW = 57, cardH = 18, cardGap = 5
  const cardX0 = 14
  const cardY0 = 40

  kpis.forEach((k, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = cardX0 + col * (cardW + cardGap)
    const y = cardY0 + row * (cardH + 4)

    // fondo card
    doc.setFillColor(...k.bg)
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'F')
    // borde izquierdo de color
    doc.setFillColor(...k.color)
    doc.rect(x, y, 3, cardH, 'F')

    // label
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...gris700)
    doc.text(k.label.toUpperCase(), x + 6, y + 6)
    // valor
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...k.color)
    doc.text(k.valor, x + 6, y + 14)
  })

  // ════════════════════════════════════════════════════════
  // HELPER: título de sección
  // ════════════════════════════════════════════════════════
  function seccion(titulo, y, color = gris900) {
    doc.setDrawColor(...gris100)
    doc.setLineWidth(0)
    // línea izquierda de acento
    doc.setFillColor(...naranja)
    doc.rect(14, y - 4, 3, 7, 'F')
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...color)
    doc.text(titulo, 20, y)
  }

  // ════════════════════════════════════════════════════════
  // VENTAS POR DÍA + MÉTODOS DE PAGO — lado a lado
  // ════════════════════════════════════════════════════════
  let yBase = cardY0 + 2 * (cardH + 4) + 12

  // — Título fila completa —
  seccion('Ventas por dia  /  Metodo de pago', yBase)

  // Columna izquierda: Ventas por día
  autoTable(doc, {
    startY: yBase + 4,
    tableWidth: 85,
    margin: { left: 14 },
    head: [['Fecha', 'Total']],
    body: rango.ventas_por_dia.map(d => [d.fecha, `S/. ${d.total.toFixed(2)}`]),
    headStyles: { fillColor: naranja, textColor: blanco, fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: gris100 },
    styles: { lineColor: [229,231,235], lineWidth: 0.1 },
  })
  const yDespuesDias = doc.lastAutoTable.finalY

  // Total ventas bajo la tabla de días
  const yTotDias = yDespuesDias + 1
  doc.setFillColor(...gris900)
  doc.rect(14, yTotDias, 85, 8, 'F')
  doc.setTextColor(...blanco)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('TOTAL', 16, yTotDias + 5.5)
  doc.text(`S/. ${rango.total_ventas.toFixed(2)}`, 96, yTotDias + 5.5, { align: 'right' })

  // Columna derecha: Métodos de pago (mismo startY, sin título propio)
  autoTable(doc, {
    startY: yBase + 4,
    tableWidth: 85,
    margin: { left: 111 },
    head: [['Metodo', 'Total']],
    body: Object.entries(rango.por_metodo_pago).map(([m, t]) => [
      m.charAt(0).toUpperCase() + m.slice(1),
      `S/. ${Number(t).toFixed(2)}`,
    ]),
    headStyles: { fillColor: naranja, textColor: blanco, fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
    bodyStyles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: gris100 },
    styles: { lineColor: [229,231,235], lineWidth: 0.1 },
  })
  const yDespuesPago = doc.lastAutoTable.finalY

  // ════════════════════════════════════════════════════════
  // GASTOS DE CAJA
  // ════════════════════════════════════════════════════════
  // Tomar el mayor de: (tabla días + rect TOTAL) vs tabla métodos de pago
  let yCurrent = Math.max(yTotDias + 8, yDespuesPago) + 12

  if (rango.total_gastos > 0) {
    seccion('Gastos de caja', yCurrent, rojo)

    autoTable(doc, {
      startY: yCurrent + 4,
      head: [['Fecha / Hora', 'Descripcion', 'Categoria', 'Registrado por', 'Monto']],
      body: (rango.detalle_gastos || []).map(g => [
        fmtFechaHora12(g.hora),
        g.descripcion,
        CATEGORIA_LABELS[g.categoria] || g.categoria,
        g.registrado_por,
        `S/. ${g.monto.toFixed(2)}`,
      ]),
      headStyles: { fillColor: rojo, textColor: blanco, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: rojoL },
      styles: { lineColor: [254,202,202], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 28 },
        4: { halign: 'right', fontStyle: 'bold' },
      },
    })

    const yTG = doc.lastAutoTable.finalY + 1
    doc.setFillColor(...rojo)
    doc.rect(14, yTG, 182, 8, 'F')
    doc.setTextColor(...blanco)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL GASTOS', 140, yTG + 5.5)
    doc.text(`S/. ${rango.total_gastos.toFixed(2)}`, 192, yTG + 5.5, { align: 'right' })
    yCurrent = yTG + 8 + 12
  }

  // ════════════════════════════════════════════════════════
  // PLATOS MÁS PEDIDOS
  // ════════════════════════════════════════════════════════
  if (rango.platos_top?.length > 0) {
    seccion('Platos mas pedidos del periodo', yCurrent)

    autoTable(doc, {
      startY: yCurrent + 4,
      head: [['#', 'Plato', 'Unidades', 'Venta total']],
      body: rango.platos_top.map((p, i) => [
        String(i + 1),
        p.nombre,
        String(p.unidades),
        `S/. ${p.venta_total.toFixed(2)}`,
      ]),
      headStyles: { fillColor: gris900, textColor: blanco, fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
      bodyStyles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: gris100 },
      styles: { lineColor: [229,231,235], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: naranja },
        2: { halign: 'center' },
        3: { halign: 'right', fontStyle: 'bold' },
      },
    })
    yCurrent = doc.lastAutoTable.finalY + 12
  }

  // ════════════════════════════════════════════════════════
  // DETALLE DE PEDIDOS
  // ════════════════════════════════════════════════════════
  if (rango.pedidos_detalle?.length > 0) {
    seccion('Detalle de pedidos', yCurrent)

    autoTable(doc, {
      startY: yCurrent + 4,
      head: [['#', 'Fecha / Hora', 'Mesa / Cliente', 'Atendido por', 'Metodo', 'Total']],
      body: rango.pedidos_detalle.map(p => [
        p.numero_ticket ? `#${String(p.numero_ticket).padStart(3, '0')}` : '—',
        fmtFechaHora12(p.hora),
        p.tipo === 'salon'
          ? `Mesa ${p.mesa}`
          : p.tipo === 'llevar'
          ? `Llevar · ${p.nombre_cliente || ''}`
          : `Delivery · ${p.nombre_cliente || ''}`,
        p.mozo,
        p.metodo_pago.charAt(0).toUpperCase() + p.metodo_pago.slice(1),
        `S/. ${p.total.toFixed(2)}`,
      ]),
      headStyles: { fillColor: gris900, textColor: blanco, fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: gris100 },
      styles: { lineColor: [229,231,235], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', fontStyle: 'bold', textColor: naranja },
        1: { cellWidth: 28 },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    })

    // Total manual — una sola vez al final
    const yTP = doc.lastAutoTable.finalY + 1
    doc.setFillColor(...gris900)
    doc.rect(14, yTP, 182, 9, 'F')
    doc.setTextColor(...blanco)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('TOTAL VENTAS DEL PERIODO', 18, yTP + 6)
    doc.text(`S/. ${rango.total_ventas.toFixed(2)}`, 192, yTP + 6, { align: 'right' })
    yCurrent = yTP + 9 + 12
  }

  // ════════════════════════════════════════════════════════
  // CAJA NETA — bloque final llamativo
  // ════════════════════════════════════════════════════════
  if (yCurrent + 26 > 275) { doc.addPage(); yCurrent = 20 }

  const colorCaja = rango.caja_neta >= 0 ? verde : rojo
  // sombra suave
  doc.setFillColor(200, 200, 200)
  doc.roundedRect(15.5, yCurrent + 1.5, 182, 24, 3, 3, 'F')
  // fondo principal
  doc.setFillColor(...colorCaja)
  doc.roundedRect(14, yCurrent, 182, 24, 3, 3, 'F')
  // etiqueta
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 255, 255, 0.8)
  doc.text('RESULTADO DEL PERIODO', 20, yCurrent + 9)
  // valor grande
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...blanco)
  doc.text('CAJA NETA', 20, yCurrent + 19)
  doc.setFontSize(18)
  doc.text(`S/. ${rango.caja_neta.toFixed(2)}`, 192, yCurrent + 19, { align: 'right' })

  // ════════════════════════════════════════════════════════
  // PIE DE PÁGINA — todas las páginas
  // ════════════════════════════════════════════════════════
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    // línea separadora
    doc.setDrawColor(...gris400)
    doc.setLineWidth(0.3)
    doc.line(14, 285, 196, 285)
    doc.setFontSize(7.5)
    doc.setTextColor(...gris400)
    doc.setFont('helvetica', 'normal')
    doc.text('RestaurantePOS  ·  Reporte generado automaticamente', 14, 290)
    doc.setFont('helvetica', 'bold')
    doc.text(`Pagina ${i} / ${pageCount}`, 196, 290, { align: 'right' })
  }

  doc.save(`reporte_${rango.fecha_ini}_${rango.fecha_fin}.pdf`)
}

function exportarCSV(pedidos, fecha) {
  const headers = ['Ticket', 'Apertura', 'Cierre', 'Tipo', 'Mesa/Cliente', 'Mozo', 'Metodo', 'Total']
  const rows = pedidos.map(p => [
    p.numero_ticket ? `#${String(p.numero_ticket).padStart(3, '0')}` : '',
    p.hora_apertura,
    p.hora_cierre,
    p.tipo,
    p.tipo === 'salon' ? `Mesa ${p.mesa}` : p.nombre_cliente || '',
    p.mozo,
    p.metodo_pago,
    p.total.toFixed(2),
  ])
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pedidos_${fecha}.csv`
  a.click()
  URL.revokeObjectURL(url)
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
  const [reporteRango, setReporteRango] = useState(null)
  const [loadingReporteRango, setLoadingReporteRango] = useState(false)

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
    setLoadingReporteRango(true)
    setReporteRango(null)
    Promise.all([
      api.get(`/reportes/ventas_diarias?fecha_ini=${rangoIni}&fecha_fin=${rangoFin}`),
      api.get(`/reportes/reporte_rango?fecha_ini=${rangoIni}&fecha_fin=${rangoFin}`),
    ]).then(([v, r]) => {
      setVentasRango(v.data)
      setReporteRango(r.data)
    }).finally(() => {
      setLoadingRango(false)
      setLoadingReporteRango(false)
    })
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
          {[['graficos', 'Gráficos'], ['detalle', 'Detalle']].map(([key, label]) => (
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
                Cierre del día — {cierre.fecha}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  ['Pedidos cerrados', cierre.total_pedidos],
                  ['Total del día',    fmt(cierre.total_general)],
                  ['Ticket promedio',  fmt(cierre.ticket_promedio)],
                  ['Cancelados',       cierre.pedidos_cancelados],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-800/60 rounded-xl p-4 text-center">
                    <p className="text-xl font-bold text-gray-100">{value}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>

              {/* Gastos y caja neta */}
              {(cierre.total_gastos > 0 || cierre.caja_neta !== undefined) && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-red-400 mb-1">Total gastos</p>
                    <p className="text-xl font-bold text-red-400">-{fmt(cierre.total_gastos ?? 0)}</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-green-400 mb-1">Caja neta</p>
                    <p className={`text-xl font-bold ${(cierre.caja_neta ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmt(cierre.caja_neta ?? cierre.total_general)}
                    </p>
                  </div>
                </div>
              )}

              {/* Gastos por categoría */}
              {cierre.por_categoria && Object.keys(cierre.por_categoria).length > 0 && (
                <div className="mb-4 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-400 mb-2">Gastos por categoría:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(cierre.por_categoria).map(([cat, monto]) => (
                      <div key={cat} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 text-sm">
                        <span className="text-red-400 capitalize">{CATEGORIA_LABELS[cat] || cat}</span>
                        <span className="text-red-300 font-semibold">{fmt(monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalle de gastos */}
              {cierre.detalle_gastos?.length > 0 && (
                <div className="mb-4 pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-400 mb-2">Detalle de gastos:</p>
                  <div className="space-y-1.5">
                    {cierre.detalle_gastos.map((g, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-500 font-mono text-xs w-16 flex-shrink-0">{fmtHora12(g.hora)}</span>
                        <span className="text-gray-300 flex-1 truncate">{g.descripcion}</span>
                        <span className="text-gray-500 text-xs capitalize flex-shrink-0">{CATEGORIA_LABELS[g.categoria] || g.categoria}</span>
                        <span className="text-red-400 font-semibold flex-shrink-0">-{fmt(g.monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(cierre.por_metodo_pago).length > 0 && (
                <div className="pt-4 border-t border-gray-800">
                  <p className="text-xs text-gray-400 mb-3">Desglose por método de pago:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(cierre.por_metodo_pago).map(([m, t]) => (
                      <div key={m} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
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
                  <div className="flex items-center gap-2 flex-wrap">
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
                    {reporteRango && (
                      <button
                        onClick={() => exportarPDFRango(reporteRango)}
                        className="btn-secondary text-sm py-1 flex items-center gap-1.5">
                        PDF del período
                      </button>
                    )}
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

          {/* Resumen rango */}
          {tab === 'rango' && reporteRango && (
            <div className="card p-5 space-y-4">
              <h2 className="text-base font-semibold text-gray-200">
                Resumen del período: {reporteRango.fecha_ini} → {reporteRango.fecha_fin} ({reporteRango.dias} días)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Pedidos', reporteRango.total_pedidos, 'text-gray-100'],
                  ['Total ventas', fmt(reporteRango.total_ventas), 'text-brand-400'],
                  ['Ticket promedio', fmt(reporteRango.ticket_promedio), 'text-gray-100'],
                  ['Cancelados', reporteRango.pedidos_cancelados, 'text-gray-400'],
                ].map(([label, val, cls]) => (
                  <div key={label} className="bg-gray-800/60 rounded-xl p-3 text-center">
                    <p className={`text-xl font-bold ${cls}`}>{val}</p>
                    <p className="text-xs text-gray-500 mt-1">{label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-400 mb-1">Total gastos</p>
                  <p className="text-xl font-bold text-red-400">-{fmt(reporteRango.total_gastos)}</p>
                </div>
                <div className={`rounded-xl p-3 text-center border ${reporteRango.caja_neta >= 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                  <p className={`text-xs mb-1 ${reporteRango.caja_neta >= 0 ? 'text-green-400' : 'text-red-400'}`}>Caja neta</p>
                  <p className={`text-xl font-bold ${reporteRango.caja_neta >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(reporteRango.caja_neta)}</p>
                </div>
              </div>
              {Object.keys(reporteRango.por_metodo_pago).length > 0 && (
                <div className="pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-400 mb-2">Por método de pago:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(reporteRango.por_metodo_pago).map(([m, t]) => (
                      <div key={m} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5">
                        <span className="text-gray-400 capitalize text-sm">{m}</span>
                        <span className="text-gray-100 font-semibold text-sm">{fmt(t)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Object.keys(reporteRango.por_categoria).length > 0 && (
                <div className="pt-3 border-t border-gray-800">
                  <p className="text-xs text-gray-400 mb-2">Gastos por categoría:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(reporteRango.por_categoria).map(([cat, monto]) => (
                      <div key={cat} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 text-sm">
                        <span className="text-red-400 capitalize">{CATEGORIA_LABELS[cat] || cat}</span>
                        <span className="text-red-300 font-semibold">{fmt(monto)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top platos */}
            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-200 mb-4">Platos más pedidos del mes</h2>
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
              <h2 className="text-base font-semibold text-gray-200 mb-4">Métodos de pago del mes</h2>
              {metodos.length === 0 && <p className="text-gray-500 text-sm">Sin datos</p>}
              {metodos.length > 0 && (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={metodos} dataKey="total" nameKey="metodo"
                        cx="50%" cy="50%" outerRadius={75} label={false}>
                        {metodos.map(m => (
                          <Cell key={m.metodo} fill={PAGO_COLORS[m.metodo] || '#6b7280'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={v => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {metodos.map(m => (
                      <div key={m.metodo} className="flex justify-between items-center text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PAGO_COLORS[m.metodo] || '#6b7280' }} />
                          <span className="capitalize text-gray-300">{m.metodo}</span>
                        </span>
                        <div className="flex gap-3">
                          <span className="text-gray-500">{m.cantidad} pedidos</span>
                          <span className="text-gray-100 font-semibold w-24 text-right">{fmt(m.total)}</span>
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
                  {m === 'todos' ? 'Todos' : m}
                </button>
              ))}
            </div>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => exportarCSV(pedidosFiltrados, fechaSel)}
                disabled={pedidosFiltrados.length === 0}
                className="btn-secondary text-sm disabled:opacity-40">
                CSV
              </button>
              <button
                onClick={() => exportarPDF(pedidosDia, fechaSel, cierre)}
                disabled={pedidosDia.length === 0}
                className="btn-primary text-sm disabled:opacity-40">
                Exportar PDF
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
              <p>Sin pedidos para esta fecha{filtroPago !== 'todos' ? ` con método ${filtroPago}` : ''}</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-3 py-3 text-gray-400 font-medium w-14">#</th>
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
                      <td className="px-3 py-3 font-bold text-brand-400 font-mono">
                        {fmtTicket(p.numero_ticket)}
                      </td>
                      <td className="px-4 py-3 text-gray-300 font-mono">{fmtHora12(p.hora_apertura)}</td>
                      <td className="px-4 py-3 text-gray-300 font-mono">{fmtHora12(p.hora_cierre)}</td>
                      <td className="px-4 py-3">
                        <span className="text-gray-200">
                          {p.tipo === 'salon' ? `Mesa ${p.mesa}` : p.nombre_cliente}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{p.mozo}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-gray-300">{p.metodo_pago}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-brand-400">{fmt(p.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-700 bg-gray-800/40">
                    <td colSpan={6} className="px-4 py-3 text-gray-400 font-medium">
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
