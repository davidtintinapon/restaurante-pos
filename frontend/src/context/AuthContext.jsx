import { createContext, useContext, useState, useCallback } from 'react'
import api from '../api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  })

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const isAdmin   = user?.rol === 'admin' || user?.rol === 'superadmin'
  const isCajero  = user?.rol === 'cajero'
  const isMozo    = user?.rol === 'mozo'
  const isCocinero = user?.rol === 'cocinero'
  const isSuperadmin = user?.rol === 'superadmin'

  return (
    <AuthCtx.Provider value={{ user, login, logout, isAdmin, isCajero, isMozo, isCocinero, isSuperadmin }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
