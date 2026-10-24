import { useEffect, useState } from 'react'
import api from '../api'
import { useToast } from '../context/ToastContext'
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

export default function Configuracion() {
  const toast = useToast()
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
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Configuración</h1>
        <p className="text-gray-500 text-sm mt-0.5">Datos del restaurante y opciones del ticket</p>
      </div>

      <form onSubmit={guardar} className="space-y-6">

        {/* Datos del negocio */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Datos del negocio</h2>
          <div>
            <label className="label">Nombre del restaurante *</label>
            <input className="input" placeholder="Ej: Pollería El Sabrosón"
              value={form.nombre_restaurante}
              onChange={e => set('nombre_restaurante', e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">RUC</label>
              <input className="input" placeholder="20123456789"
                value={form.ruc}
                onChange={e => set('ruc', e.target.value)} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" placeholder="044-123456"
                value={form.telefono}
                onChange={e => set('telefono', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Dirección</label>
            <input className="input" placeholder="Av. Principal 123, Guadalupe"
              value={form.direccion}
              onChange={e => set('direccion', e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="contacto@restaurante.com"
              value={form.email}
              onChange={e => set('email', e.target.value)} />
          </div>
        </div>

        {/* Ticket y facturación */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Ticket y facturación</h2>
          <div>
            <label className="label">Moneda</label>
            <div className="flex gap-2">
              {['S/.', '$', '€'].map(m => (
                <button key={m} type="button"
                  onClick={() => set('moneda', m)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                    ${form.moneda === m
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-100'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Pie de ticket</label>
            <input className="input" placeholder="Ej: ¡Gracias por su visita! Vuelva pronto."
              value={form.pie_ticket}
              onChange={e => set('pie_ticket', e.target.value)} />
            <p className="text-xs text-gray-600 mt-1">Texto que aparece al final del ticket PDF</p>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-gray-800">
            <div>
              <p className="text-sm text-gray-300">Mostrar IGV en ticket</p>
              <p className="text-xs text-gray-600">Desglosa el IGV ({form.igv_porcentaje}%) en el ticket</p>
            </div>
            <button type="button"
              onClick={() => set('mostrar_igv', !form.mostrar_igv)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${form.mostrar_igv ? 'bg-brand-500' : 'bg-gray-700'}`}>
              <span className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-full shadow transition-transform
                ${form.mostrar_igv ? 'translate-x-[18px]' : 'translate-x-0'}`} />
            </button>
          </div>
          {form.mostrar_igv && (
            <div>
              <label className="label">% IGV</label>
              <input className="input w-24" type="number" min={0} max={30}
                value={form.igv_porcentaje}
                onChange={e => set('igv_porcentaje', e.target.value)} />
            </div>
          )}
        </div>

        {/* Impresora térmica */}
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Impresora de cocina</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Impresora térmica 80 mm conectada por red (LAN o WiFi). El ticket se enviará automáticamente al presionar "Enviar a cocina".
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="label">IP de la impresora</label>
              <input
                className="input font-mono"
                placeholder="Ej: 192.168.1.100"
                value={form.printer_ip}
                onChange={e => set('printer_ip', e.target.value)}
              />
              <p className="text-xs text-gray-600 mt-1">
                Deja vacío si no tienes impresora de cocina.
              </p>
            </div>
            <div>
              <label className="label">Puerto</label>
              <input
                className="input font-mono"
                placeholder="9100"
                value={form.printer_port}
                onChange={e => set('printer_port', e.target.value)}
              />
              <p className="text-xs text-gray-600 mt-1">Por defecto: 9100</p>
            </div>
          </div>
          {form.printer_ip && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17H17.01M7 17H7.01M6 11V7a2 2 0 012-2h8a2 2 0 012 2v4M3 11h18v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8z" />
              </svg>
              <span>Los tickets se imprimirán en <strong className="font-semibold">{form.printer_ip}:{form.printer_port || '9100'}</strong> al enviar a cocina.</span>
            </div>
          )}
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
    </div>
  )
}
