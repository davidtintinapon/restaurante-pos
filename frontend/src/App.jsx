import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'

import Login               from './pages/Login'
import Dashboard           from './pages/Dashboard'
import DashboardCajero     from './pages/DashboardCajero'
import SuperadminDashboard from './pages/SuperadminDashboard'
import Mesas               from './pages/Mesas'
import Pedido              from './pages/Pedido'
import Cocina              from './pages/Cocina'
import Carta               from './pages/Carta'
import Usuarios            from './pages/Usuarios'
import Reportes            from './pages/Reportes'
import Superadmin          from './pages/Superadmin'
import Configuracion       from './pages/Configuracion'
import GastosCaja          from './pages/GastosCaja'

const ADMIN    = ['admin', 'superadmin']
const STAFF    = ['admin', 'cajero', 'mozo', 'superadmin']
const COCINA_R = ['admin', 'cocinero', 'superadmin']
const ALL      = ['admin', 'cajero', 'mozo', 'cocinero', 'superadmin']

function DashboardRouter() {
  const { user } = useAuth()
  if (user?.rol === 'superadmin') return <SuperadminDashboard />
  if (user?.rol === 'cajero')     return <DashboardCajero />
  return <Dashboard />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              <PrivateRoute roles={ALL}>
                <Layout />
              </PrivateRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />

              <Route path="dashboard" element={
                <PrivateRoute roles={['admin', 'cajero', 'superadmin']}>
                  <DashboardRouter />
                </PrivateRoute>
              } />

              <Route path="mesas" element={
                <PrivateRoute roles={STAFF}><Mesas /></PrivateRoute>
              } />

              <Route path="pedidos/nuevo" element={
                <PrivateRoute roles={STAFF}><Pedido /></PrivateRoute>
              } />

              <Route path="pedidos/mesa/:mesa_id" element={
                <PrivateRoute roles={STAFF}><Pedido /></PrivateRoute>
              } />

              <Route path="pedidos/:pedido_id" element={
                <PrivateRoute roles={STAFF}><Pedido /></PrivateRoute>
              } />

              <Route path="cocina" element={
                <PrivateRoute roles={COCINA_R}><Cocina /></PrivateRoute>
              } />

              <Route path="carta" element={
                <PrivateRoute roles={ADMIN}><Carta /></PrivateRoute>
              } />

              <Route path="usuarios" element={
                <PrivateRoute roles={ADMIN}><Usuarios /></PrivateRoute>
              } />

              <Route path="reportes" element={
                <PrivateRoute roles={ADMIN}><Reportes /></PrivateRoute>
              } />

              <Route path="gastos" element={
                <PrivateRoute roles={['admin', 'cajero', 'superadmin']}><GastosCaja /></PrivateRoute>
              } />

              <Route path="configuracion" element={
                <PrivateRoute roles={ADMIN}><Configuracion /></PrivateRoute>
              } />

              <Route path="superadmin" element={
                <PrivateRoute roles={['superadmin']}><Superadmin /></PrivateRoute>
              } />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}