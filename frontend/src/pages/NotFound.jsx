import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto p-6 mt-10">
      <div className="empty-state">
        <p className="text-4xl font-black text-navy">404</p>
        <p className="font-bold text-navy mt-2">Página no encontrada</p>
        <p className="mt-1">La ruta que buscas no existe o fue movida.</p>
        <Link to="/" className="btn-primary mt-4">Volver al inicio</Link>
      </div>
    </div>
  )
}
