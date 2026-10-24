import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 8000, // 8 s — si el backend no responde, falla rápido en vez de colgarse
})

// ── Adjuntar token automáticamente ───────────────────────────────────────────
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// ── Respuestas ────────────────────────────────────────────────────────────────
api.interceptors.response.use(
  r => r,
  async err => {
    const config = err.config

    // Token expirado → logout (solo una vez, evitar bucle)
    if (err.response?.status === 401 && !config._retry401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(err)
    }

    // Reintento automático en error de red o timeout (máx. 2 intentos)
    // No reintentar POST/PATCH/DELETE para evitar operaciones duplicadas
    const metodoSeguro = !config.method || ['get', 'head', 'options'].includes(config.method.toLowerCase())
    const esErrorRed = !err.response // sin respuesta = red caída o timeout
    config._retryCount = config._retryCount || 0

    if (metodoSeguro && esErrorRed && config._retryCount < 2) {
      config._retryCount += 1
      // Espera exponencial: 1 s, 2 s
      await new Promise(res => setTimeout(res, config._retryCount * 1000))
      return api(config)
    }

    return Promise.reject(err)
  }
)

export default api