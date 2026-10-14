import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  ['Dashboard',  '📊', '/dashboard',  ['admin', 'cajero', 'superadmin']],
  ['Mesas',      '🪑', '/mesas',      ['admin', 'cajero', 'mozo']],
  ['Cocina',     '👨‍🍳', '/cocina',    ['admin', 'cocinero']],
  ['Carta',      '📋', '/carta',      ['admin']],
  ['Usuarios',   '👥', '/usuarios',   ['admin']],
  ['Reportes',   '📈', '/reportes',   ['admin']],
  ['Superadmin', '⚙️', '/superadmin', ['superadmin']],
]

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sideOpen, setSideOpen] = useState(true)

  const items = NAV_ITEMS.filter(([,,, roles]) => roles.includes(user?.rol))

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside className={`${sideOpen ? 'w-56' : 'w-16'} flex-shrink-0 bg-gray-900 border-r border-gray-800
                         flex flex-col transition-all duration-200 z-20`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
          <span className="text-2xl">🍽️</span>
          {sideOpen && <span className="font-bold text-gray-100 truncate">RestaurantePOS</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {items.map(([label, icon, path]) => {
            const active = location.pathname.startsWith(path)
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg mb-0.5
                            text-sm font-medium transition-colors duration-100
                            ${active
                              ? 'bg-brand-500/20 text-brand-400'
                              : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'}`}
              >
                <span className="text-lg flex-shrink-0">{icon}</span>
                {sideOpen && <span className="truncate">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="border-t border-gray-800 p-3">
          <div className={`flex items-center gap-3 ${sideOpen ? '' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center
                            text-brand-400 font-bold text-sm flex-shrink-0">
              {user?.nombre?.[0]?.toUpperCase()}
            </div>
            {sideOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-100 truncate">{user?.nombre}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.rol}</p>
              </div>
            )}
          </div>
          {sideOpen && (
            <button onClick={logout}
              className="mt-3 w-full text-left text-xs text-gray-500 hover:text-red-400 transition-colors px-1 py-1">
              Cerrar sesión →
            </button>
          )}
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 flex-shrink-0">
          <button onClick={() => setSideOpen(s => !s)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-gray-400 text-sm">
            {new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
