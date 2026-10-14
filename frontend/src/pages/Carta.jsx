import { useEffect, useState } from 'react'
import api from '../api'
import { useToast } from '../context/ToastContext'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'

function fmt(n) { return `S/. ${Number(n || 0).toFixed(2)}` }

export default function Carta() {
  const toast = useToast()
  const [carta, setCarta] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal categoría
  const [modalCat, setModalCat] = useState(false)
  const [editCat, setEditCat] = useState(null)
  const [formCat, setFormCat] = useState({ nombre: '', orden: 0 })
  const [savingCat, setSavingCat] = useState(false)

  // Modal plato
  const [modalPlato, setModalPlato] = useState(false)
  const [editPlato, setEditPlato] = useState(null)
  const [catParaPlato, setCatParaPlato] = useState(null)
  const [formPlato, setFormPlato] = useState({
    nombre: '', descripcion: '', precio: '', categoria_id: '',
    tiene_stock: false, stock: 0
  })
  const [savingPlato, setSavingPlato] = useState(false)

  // Modal ajuste stock
  const [modalStock, setModalStock] = useState(false)
  const [platoStock, setPlatoStock] = useState(null)
  const [nuevoStock, setNuevoStock] = useState(0)
  const [savingStock, setSavingStock] = useState(false)

  const cargar = () => {
    api.get('/carta/').then(r => setCarta(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { cargar() }, [])

  // ── Categorías ───────────────────────────────────────────
  const abrirModalCat = (cat = null) => {
    setEditCat(cat)
    setFormCat(cat ? { nombre: cat.nombre, orden: cat.orden } : { nombre: '', orden: carta.length })
    setModalCat(true)
  }

  const guardarCat = async e => {
    e.preventDefault()
    setSavingCat(true)
    try {
      if (editCat) {
        await api.patch(`/carta/categorias/${editCat.id}`, formCat)
        toast('Categoría actualizada', 'success')
      } else {
        await api.post('/carta/categorias', formCat)
        toast('Categoría creada', 'success')
      }
      setModalCat(false)
      cargar()
    } catch (err) { toast(err.response?.data?.detail || 'Error', 'error') }
    finally { setSavingCat(false) }
  }

  const eliminarCat = async cat => {
    if (!confirm(`¿Desactivar la categoría "${cat.nombre}"?`)) return
    await api.delete(`/carta/categorias/${cat.id}`)
    toast('Categoría desactivada', 'success')
    cargar()
  }

  // ── Platos ────────────────────────────────────────────────
  const abrirModalPlato = (cat, plato = null) => {
    setCatParaPlato(cat)
    setEditPlato(plato)
    setFormPlato(plato
      ? {
          nombre: plato.nombre,
          descripcion: plato.descripcion || '',
          precio: plato.precio,
          categoria_id: plato.categoria_id,
          tiene_stock: plato.tiene_stock || false,
          stock: plato.stock || 0,
        }
      : { nombre: '', descripcion: '', precio: '', categoria_id: cat.id, tiene_stock: false, stock: 0 })
    setModalPlato(true)
  }

  const guardarPlato = async e => {
    e.preventDefault()
    setSavingPlato(true)
    try {
      const payload = {
        ...formPlato,
        precio: Number(formPlato.precio),
        stock: Number(formPlato.stock),
      }
      if (editPlato) {
        await api.patch(`/carta/platos/${editPlato.id}`, payload)
        toast('Plato actualizado', 'success')
      } else {
        await api.post('/carta/platos', payload)
        toast('Plato creado', 'success')
      }
      setModalPlato(false)
      cargar()
    } catch (err) { toast(err.response?.data?.detail || 'Error', 'error') }
    finally { setSavingPlato(false) }
  }

  const toggleDisponible = async plato => {
    await api.patch(`/carta/platos/${plato.id}`, { disponible: !plato.disponible })
    cargar()
  }

  const eliminarPlato = async plato => {
    if (!confirm(`¿Desactivar "${plato.nombre}"?`)) return
    await api.delete(`/carta/platos/${plato.id}`)
    toast('Plato desactivado', 'success')
    cargar()
  }

  // ── Stock ─────────────────────────────────────────────────
  const abrirModalStock = plato => {
    setPlatoStock(plato)
    setNuevoStock(plato.stock || 0)
    setModalStock(true)
  }

  const guardarStock = async e => {
    e.preventDefault()
    setSavingStock(true)
    try {
      await api.patch(`/carta/platos/${platoStock.id}`, {
        stock: Number(nuevoStock),
        disponible: Number(nuevoStock) > 0,
      })
      toast('Stock actualizado', 'success')
      setModalStock(false)
      cargar()
    } catch { toast('Error', 'error') }
    finally { setSavingStock(false) }
  }

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Carta del restaurante</h1>
          <p className="text-gray-500 text-sm mt-0.5">{carta.length} categorías</p>
        </div>
        <button onClick={() => abrirModalCat()} className="btn-primary">+ Nueva categoría</button>
      </div>

      {carta.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">📋</p>
          <p>La carta está vacía. Crea una categoría para empezar.</p>
        </div>
      )}

      {carta.map(cat => (
        <div key={cat.id} className="card overflow-hidden">
          {/* Header categoría */}
          <div className="flex items-center justify-between px-5 py-3 bg-gray-800/50 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-100">{cat.nombre}</span>
              <span className="text-xs text-gray-500">{cat.platos.length} platos</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => abrirModalPlato(cat)} className="btn-secondary text-xs py-1">+ Plato</button>
              <button onClick={() => abrirModalCat(cat)} className="text-gray-400 hover:text-gray-200 px-2">✏️</button>
              <button onClick={() => eliminarCat(cat)} className="text-gray-500 hover:text-red-400 px-2">🗑</button>
            </div>
          </div>

          {/* Platos */}
          {cat.platos.length === 0 && (
            <p className="text-gray-500 text-sm px-5 py-4">Sin platos en esta categoría</p>
          )}
          <div className="divide-y divide-gray-800">
            {cat.platos.map(p => (
              <div key={p.id} className={`flex flex-wrap items-center gap-2 px-4 py-3 ${!p.disponible ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-100">{p.nombre}</p>
                  {p.descripcion && <p className="text-xs text-gray-500 truncate">{p.descripcion}</p>}
                </div>
                <span className="font-bold text-brand-400 text-sm">{fmt(p.precio)}</span>

                {/* Badge stock */}
                {p.tiene_stock && (
                  <button
                    onClick={() => abrirModalStock(p)}
                    className={`text-xs px-2 py-1 rounded-md font-semibold transition-colors flex-shrink-0
                      ${p.stock === 0
                        ? 'bg-red-900/40 text-red-400 border border-red-700'
                        : p.stock <= 5
                        ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-700'
                        : 'bg-green-900/40 text-green-400 border border-green-700'}`}>
                    📦 {p.stock} uds
                  </button>
                )}

                {/* Toggle disponible */}
                <button onClick={() => toggleDisponible(p)}
                  title={p.disponible ? 'Marcar no disponible' : 'Marcar disponible'}
                  className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0
                    ${p.disponible ? 'bg-brand-500' : 'bg-gray-700'}`}>
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all
                    ${p.disponible ? 'left-5' : 'left-1'}`} />
                </button>
                <button onClick={() => abrirModalPlato(cat, p)}
                  className="text-gray-400 hover:text-gray-200 transition-colors">✏️</button>
                <button onClick={() => eliminarPlato(p)}
                  className="text-gray-500 hover:text-red-400 transition-colors">🗑</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal categoría */}
      <Modal open={modalCat} onClose={() => setModalCat(false)} title={editCat ? 'Editar categoría' : 'Nueva categoría'}>
        <form onSubmit={guardarCat} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={formCat.nombre}
              onChange={e => setFormCat(f => ({ ...f, nombre: e.target.value }))} required autoFocus />
          </div>
          <div>
            <label className="label">Orden</label>
            <input type="number" className="input" value={formCat.orden} min={0}
              onChange={e => setFormCat(f => ({ ...f, orden: Number(e.target.value) }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={savingCat}>
              {savingCat ? <Spinner size="sm" className="mx-auto" /> : (editCat ? 'Guardar' : 'Crear')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalCat(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Modal plato */}
      <Modal open={modalPlato} onClose={() => setModalPlato(false)}
        title={editPlato ? 'Editar plato' : `Nuevo plato — ${catParaPlato?.nombre}`}>
        <form onSubmit={guardarPlato} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={formPlato.nombre}
              onChange={e => setFormPlato(f => ({ ...f, nombre: e.target.value }))} required autoFocus />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea className="input resize-none" rows={2} value={formPlato.descripcion}
              onChange={e => setFormPlato(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Ingredientes, presentación..." />
          </div>
          <div>
            <label className="label">Precio (S/.) *</label>
            <input type="number" className="input" step="0.01" min="0" value={formPlato.precio}
              onChange={e => setFormPlato(f => ({ ...f, precio: e.target.value }))} required />
          </div>

          {/* Control de stock */}
          <div className="border border-gray-700 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-200">Control de stock</p>
                <p className="text-xs text-gray-500">Actívalo para gaseosas, cervezas, etc.</p>
              </div>
              <button type="button"
                onClick={() => setFormPlato(f => ({ ...f, tiene_stock: !f.tiene_stock }))}
                className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0
                  ${formPlato.tiene_stock ? 'bg-brand-500' : 'bg-gray-700'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all
                  ${formPlato.tiene_stock ? 'left-5' : 'left-1'}`} />
              </button>
            </div>
            {formPlato.tiene_stock && (
              <div>
                <label className="label">Stock inicial</label>
                <input type="number" className="input" min={0} value={formPlato.stock}
                  onChange={e => setFormPlato(f => ({ ...f, stock: e.target.value }))} />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={savingPlato}>
              {savingPlato ? <Spinner size="sm" className="mx-auto" /> : (editPlato ? 'Guardar' : 'Crear plato')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalPlato(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>

      {/* Modal ajuste stock */}
      <Modal open={modalStock} onClose={() => setModalStock(false)}
        title={`Stock — ${platoStock?.nombre}`}>
        <form onSubmit={guardarStock} className="space-y-4">
          <div className="text-center py-2">
            <p className="text-5xl font-black text-gray-100">{platoStock?.stock}</p>
            <p className="text-sm text-gray-500 mt-1">unidades actuales</p>
          </div>
          <div>
            <label className="label">Nuevo stock</label>
            <input type="number" className="input text-center text-xl" min={0}
              value={nuevoStock}
              onChange={e => setNuevoStock(e.target.value)}
              autoFocus />
          </div>
          <div className="flex gap-2">
            {[10, 24, 48].map(n => (
              <button key={n} type="button"
                onClick={() => setNuevoStock(String(n))}
                className="flex-1 btn-secondary text-sm">
                +{n}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" className="btn-primary flex-1" disabled={savingStock}>
              {savingStock ? <Spinner size="sm" className="mx-auto" /> : 'Guardar stock'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalStock(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}