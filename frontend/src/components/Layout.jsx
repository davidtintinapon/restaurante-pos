import { useState, useEffect } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Iconos SVG inline (sin dependencia externa) ──────────────
const Icon = ({ d, className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.75}
       viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  dashboard:    'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  mesas:        'M3 10h18M3 14h18M10 3v18M14 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z',
  cocina:       'M12 6v6m0 0v6m0-6h6m-6 0H6M9.5 3a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM20.5 20.5l-3.5-3.5',
  carta:        'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  usuarios:     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  reportes:     'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  gastos:       'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  configuracion:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  superadmin:   'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  logout:       'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  menu:         'M4 6h16M4 12h16M4 18h16',
  chevron:      'M15 19l-7-7 7-7',
  x:            'M6 18L18 6M6 6l12 12',
}

const NAV_GROUPS = [
  {
    label: 'Operaciones',
    items: [
      ['Dashboard',   '/dashboard',      ['admin', 'cajero', 'superadmin'], 'dashboard'],
      ['Mesas',       '/mesas',          ['admin', 'cajero', 'mozo'],       'mesas'],
      ['Cocina',      '/cocina',         ['admin', 'cajero', 'cocinero'],   'cocina'],
    ],
  },
  {
    label: 'Gestión',
    items: [
      ['Carta',       '/carta',          ['admin'],                         'carta'],
      ['Usuarios',    '/usuarios',       ['admin'],                         'usuarios'],
      ['Gastos',      '/gastos',         ['admin', 'cajero'],               'gastos'],
    ],
  },
  {
    label: 'Análisis',
    items: [
      ['Reportes',    '/reportes',       ['admin'],                         'reportes'],
    ],
  },
  {
    label: 'Sistema',
    items: [
      ['Configuración', '/configuracion', ['admin'],                        'configuracion'],
      ['Superadmin',    '/superadmin',   ['superadmin'],                    'superadmin'],
    ],
  },
]

// Encuentra el label de la ruta activa para el topbar móvil
function usePageTitle(rol) {
  const location = useLocation()
  for (const group of NAV_GROUPS) {
    for (const [label, path, roles] of group.items) {
      if (roles.includes(rol) && location.pathname.startsWith(path)) return label
    }
  }
  return 'RestaurantePOS'
}

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const rolUser = user?.rol

  // En móvil: sidebar cerrado por defecto; en desktop: abierto
  const [sideOpen, setSideOpen] = useState(window.innerWidth >= 768)
  // En móvil, el sidebar es un drawer con overlay
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const pageTitle = usePageTitle(rolUser)

  // Cerrar sidebar al navegar en móvil
  useEffect(() => {
    if (window.innerWidth < 768) setSideOpen(false)
  }, [location.pathname])

  // Ajustar al cambiar tamaño de ventana
  useEffect(() => {
    const handler = () => {
      if (window.innerWidth >= 768) setSideOpen(true)
      else setSideOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-[18px] border-b border-gray-800/80">
        <span className="text-xl flex-shrink-0 select-none">🍽️</span>
        <div className="min-w-0">
          <p className="font-bold text-gray-100 text-sm leading-tight truncate">RestaurantePOS</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Sistema de gestión</p>
        </div>
        {/* Botón cerrar en móvil */}
        <button
          onClick={() => setSideOpen(false)}
          className="ml-auto md:hidden p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-800 transition-colors">
          <Icon d={ICONS.x} className="w-4 h-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden space-y-4">
        {NAV_GROUPS.map(group => {
          const visibles = group.items.filter(([,, roles]) => roles.includes(rolUser))
          if (visibles.length === 0) return null
          return (
            <div key={group.label}>
              <p className="section-title">{group.label}</p>
              {visibles.map(([label, path,, iconKey]) => {
                const active = location.pathname.startsWith(path)
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`relative flex items-center gap-3 mx-2 rounded-lg mb-0.5
                                px-3 py-2.5 text-sm font-medium transition-all duration-100
                                ${active
                                  ? 'bg-brand-500/15 text-brand-400'
                                  : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'}`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-brand-500 rounded-r-full" />
                    )}
                    <span className={`flex-shrink-0 ${active ? 'text-brand-400' : ''}`}>
                      <Icon d={ICONS[iconKey]} className="w-[18px] h-[18px]" />
                    </span>
                    <span className="truncate">{label}</span>
                  </Link>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* Usuario + logout */}
      <div className="border-t border-gray-800/80 p-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-brand-500/20 ring-1 ring-brand-500/30
                          flex items-center justify-center
                          text-brand-400 font-bold text-sm flex-shrink-0">
            {user?.nombre?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-200 truncate leading-tight">{user?.nombre}</p>
            <p className="text-[11px] text-gray-500 capitalize">{user?.rol}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-2.5 w-full flex items-center gap-2 px-2 py-1.5 rounded-md
                     text-xs text-gray-500 hover:text-red-400 hover:bg-red-500/10
                     transition-all duration-150 group">
          <Icon d={ICONS.logout} className="w-3.5 h-3.5 group-hover:text-red-400" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">

      {/* ── Overlay móvil ───────────────────────────────── */}
      {sideOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setSideOpen(false)}
        />
      )}

      {/* ── Sidebar — drawer en móvil, fijo en desktop ── */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-40
        w-[232px] flex-shrink-0
        bg-gray-900 border-r border-gray-800/80
        flex flex-col
        transition-transform duration-200 ease-out
        ${sideOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-[62px]'}
      `}>
        {/* Desktop colapsado: solo iconos */}
        <div className={sideOpen ? 'flex flex-col h-full' : 'hidden md:flex md:flex-col md:h-full'}>
          {sideOpen ? (
            <SidebarContent />
          ) : (
            /* Sidebar colapsado en desktop */
            <>
              <div className="flex items-center justify-center py-[18px] border-b border-gray-800/80">
                <span className="text-xl select-none">🍽️</span>
              </div>
              <nav className="flex-1 py-3 overflow-y-auto space-y-4">
                {NAV_GROUPS.map(group => {
                  const visibles = group.items.filter(([,, roles]) => roles.includes(rolUser))
                  if (visibles.length === 0) return null
                  return (
                    <div key={group.label}>
                      <div className="mx-3 border-t border-gray-800/60 mb-1" />
                      {visibles.map(([label, path,, iconKey]) => {
                        const active = location.pathname.startsWith(path)
                        return (
                          <Link key={path} to={path} title={label}
                            className={`relative flex items-center justify-center mx-2 rounded-lg mb-0.5
                                        py-2.5 transition-all duration-100
                                        ${active ? 'bg-brand-500/15 text-brand-400' : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'}`}>
                            {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-brand-500 rounded-r-full" />}
                            <Icon d={ICONS[iconKey]} className="w-[18px] h-[18px]" />
                          </Link>
                        )
                      })}
                    </div>
                  )
                })}
              </nav>
              <div className="border-t border-gray-800/80 p-3 flex justify-center">
                <div className="w-8 h-8 rounded-full bg-brand-500/20 ring-1 ring-brand-500/30
                                flex items-center justify-center text-brand-400 font-bold text-sm">
                  {user?.nombre?.[0]?.toUpperCase()}
                </div>
              </div>
            </>
          )}
        </div>

      </aside>

      {/* ── Main ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="h-14 bg-gray-950 border-b border-gray-800/80
                           flex items-center px-4 gap-3 flex-shrink-0">
          <button
            onClick={() => setSideOpen(s => !s)}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-800
                       transition-all duration-150 flex-shrink-0">
            <Icon d={ICONS.menu} className="w-5 h-5" />
          </button>

          <div className="w-px h-5 bg-gray-800 flex-shrink-0" />

          {/* En desktop: fecha. En móvil: nombre de página */}
          <span className="text-gray-500 text-sm capitalize hidden sm:block">
            {new Date().toLocaleDateString('es-PE', {
              weekday: 'long', day: 'numeric', month: 'long',
              timeZone: 'America/Lima'
            })}
          </span>
          <span className="text-gray-200 text-sm font-semibold sm:hidden truncate">
            {pageTitle}
          </span>

          <div className="flex-1" />

          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-widest hidden sm:block">
            {user?.rol}
          </span>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-950">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
