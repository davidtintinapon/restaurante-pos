import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Spinner from '../components/ui/Spinner'

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      if (user.rol === 'cocinero') navigate('/cocina')
      else if (user.rol === 'mozo') navigate('/mesas')
      else navigate('/dashboard')
    } catch (err) {
      toast(err.response?.data?.detail || 'Credenciales incorrectas', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10 gap-4">
          {/* Ícono Z */}
          <svg width="88" height="88" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="110" height="110" rx="14" fill="#0B2545"/>
            <polygon points="14,14 96,14 96,30 34,82 64,82 64,96 14,96 14,82 76,30 14,30" fill="#FFFFFF"/>
            <polygon points="72,82 91,82 110,104 92,104" fill="#6E9BCB"/>
          </svg>
          {/* Wordmark centrado */}
          <p style={{
            fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
            fontWeight: 800,
            fontSize: '28px',
            letterSpacing: '10px',
            color: '#FFFFFF',
            textAlign: 'center',
            paddingLeft: '10px', /* compensa el letter-spacing del último char */
          }}>
            ZYQUID
          </p>
        </div>

        <div className="card p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-gray-100 mb-5">Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                placeholder="correo@restaurante.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-2" disabled={loading}>
              {loading ? <><Spinner size="sm" /> Ingresando...</> : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          © {new Date().getFullYear()} Zyquid · v1.0
        </p>
      </div>
    </div>
  )
}
