export default function Spinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return (
    <div className={`${s[size]} border-2 border-gray-600 border-t-brand-500 rounded-full animate-spin ${className}`} />
  )
}

export function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center h-screen bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-gray-400 text-sm">Cargando...</p>
      </div>
    </div>
  )
}
