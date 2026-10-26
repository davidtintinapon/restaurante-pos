import { useEffect, useState } from 'react'
import api from '../api'
import { useToast } from '../context/ToastContext'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import Spinner from '../components/ui/Spinner'

const ROLES = ['admin', 'cajero', 'mozo', 'cocinero']

export default function Usuarios() {
  const toast = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalUser, setModalUser] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'mozo' })
  const [saving, setSaving] = useState(false)

  const cargar = () => {
    api.get('/usuarios/').then(r => setUsuarios(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { cargar() }, [])

  const abrirModal = (u = null) => {
    setEditUser(u)
    setForm(u
      ? { nombre: u.nombre, email: u.email, password: '', rol: u.rol }
      : { nombre: '', email: '', password: '', rol: 'mozo' })
    setModalUser(true)
  }

  const guardar = async e => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    if (!payload.password) delete payload.password
    try {
      if (editUser) {
        await api.patch(`/usuarios/${editUser.id}`, payload)
        toast('Usuario actualizado', 'success')
      } else {
        await api.post('/usuarios/', payload)
        toast('Usuario creado', 'success')
      }
      setModalUser(false)
      cargar()
    } catch (err) {
      toast(err.response?.data?.detail || 'Error', 'error')
    } finally { setSaving(false) }
  }

  const eliminar = async u => {
    if (!confirm(`¿Desactivar a "${u.nombre}"?`)) return
    await api.delete(`/usuarios/${u.id}`)
    toast('Usuario desactivado', 'success')
    cargar()
  }

  if (loading) return <div className="flex justify-center mt-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Usuarios</h1>
          <p className="text-gray-500 text-sm mt-0.5">{usuarios.length} usuarios activos</p>
        </div>
        <button onClick={() => abrirModal()} className="btn-primary">+ Nuevo usuario</button>
      </div>

      <div className="card overflow-hidden">
        {usuarios.length === 0 && (
          <p className="text-gray-500 text-center py-10">No hay usuarios</p>
        )}
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Nombre</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Email</th>
              <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Rol</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {usuarios.map(u => (
              <tr key={u.id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center
                                    text-brand-400 font-bold text-sm flex-shrink-0">
                      {u.nombre[0].toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-gray-100">{u.nombre}</span>
                      <div className="sm:hidden mt-0.5"><Badge value={u.rol} /></div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm hidden sm:table-cell">{u.email}</td>
                <td className="px-4 py-3 hidden sm:table-cell"><Badge value={u.rol} /></td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => abrirModal(u)}
                      className="text-sm text-gray-400 hover:text-gray-100 transition-colors px-2 py-1">Editar</button>
                    <button onClick={() => eliminar(u)}
                      className="text-sm text-gray-500 hover:text-red-400 transition-colors px-2 py-1">Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalUser} onClose={() => setModalUser(false)} title={editUser ? 'Editar usuario' : 'Nuevo usuario'}>
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input className="input" value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required autoFocus />
          </div>
          <div>
            <label className="label">Email *</label>
            <input type="email" className="input" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">{editUser ? 'Nueva contraseña (dejar vacío para mantener)' : 'Contraseña *'}</label>
            <input type="password" className="input" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required={!editUser} placeholder="••••••••" />
          </div>
          <div>
            <label className="label">Rol</label>
            <select className="input" value={form.rol}
              onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
              {ROLES.map(r => (
                <option key={r} value={r} className="bg-gray-800 capitalize">{r}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? <Spinner size="sm" className="mx-auto" /> : (editUser ? 'Guardar' : 'Crear usuario')}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setModalUser(false)}>Cancelar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
