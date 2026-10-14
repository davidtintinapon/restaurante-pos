const VARIANTS = {
  // Mesa estados
  libre:          'bg-green-900/50 text-green-300 border border-green-800',
  ocupada:        'bg-red-900/50 text-red-300 border border-red-800',
  reservada:      'bg-yellow-900/50 text-yellow-300 border border-yellow-800',
  cuenta_pedida:  'bg-purple-900/50 text-purple-300 border border-purple-800',
  // Pedido estados
  abierto:        'bg-blue-900/50 text-blue-300 border border-blue-800',
  en_cocina:      'bg-orange-900/50 text-orange-300 border border-orange-800',
  listo:          'bg-green-900/50 text-green-300 border border-green-800',
  cerrado:        'bg-gray-800 text-gray-400 border border-gray-700',
  cancelado:      'bg-red-900/40 text-red-400 border border-red-900',
  // Item estados
  pendiente:      'bg-yellow-900/50 text-yellow-300 border border-yellow-800',
  en_preparacion: 'bg-orange-900/50 text-orange-300 border border-orange-800',
  entregado:      'bg-gray-800 text-gray-400 border border-gray-700',
  // Roles
  admin:      'bg-brand-900/50 text-brand-300 border border-brand-800',
  cajero:     'bg-teal-900/50 text-teal-300 border border-teal-800',
  mozo:       'bg-indigo-900/50 text-indigo-300 border border-indigo-800',
  cocinero:   'bg-amber-900/50 text-amber-300 border border-amber-800',
  superadmin: 'bg-pink-900/50 text-pink-300 border border-pink-800',
}

const LABELS = {
  libre: 'Libre', ocupada: 'Ocupada', reservada: 'Reservada', cuenta_pedida: 'Cuenta pedida',
  abierto: 'Abierto', en_cocina: 'En cocina', listo: 'Listo', cerrado: 'Cerrado', cancelado: 'Cancelado',
  pendiente: 'Pendiente', en_preparacion: 'En preparación', entregado: 'Entregado',
  admin: 'Admin', cajero: 'Cajero', mozo: 'Mozo', cocinero: 'Cocinero', superadmin: 'Superadmin',
}

export default function Badge({ value, className = '' }) {
  const cls = VARIANTS[value] || 'bg-gray-800 text-gray-400 border border-gray-700'
  return (
    <span className={`badge ${cls} ${className}`}>
      {LABELS[value] || value}
    </span>
  )
}
