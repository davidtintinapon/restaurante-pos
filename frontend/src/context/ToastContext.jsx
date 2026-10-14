import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, type = 'success', duration = 3500) => {
    const id = ++_id
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration)
  }, [])

  const remove = id => setToasts(t => t.filter(x => x.id !== id))

  const COLORS = {
    success: 'bg-green-600',
    error:   'bg-red-600',
    info:    'bg-blue-600',
    warn:    'bg-yellow-600',
  }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`${COLORS[t.type] || COLORS.info} text-white px-4 py-3 rounded-xl shadow-2xl
                        text-sm font-medium pointer-events-auto flex items-center gap-3
                        animate-slide-in max-w-xs`}
          >
            <span className="flex-1">{t.msg}</span>
            <button onClick={() => remove(t.id)} className="opacity-70 hover:opacity-100 text-lg leading-none">×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)
