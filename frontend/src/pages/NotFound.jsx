import { Link, useNavigate } from 'react-router-dom'
import { BusFront } from 'lucide-react'
import Button from '../components/common/Button.jsx'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="max-w-md mx-auto p-6 text-center mt-10">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
        <BusFront size={32} aria-hidden="true" />
      </span>
      <p className="text-7xl font-black text-primary leading-none">404</p>
      <h1 className="text-2xl font-bold text-navy dark:text-white mt-4">Página no encontrada</h1>
      <p className="text-stone-500 dark:text-stone-400 mt-2 mb-6">
        La ruta que buscas no existe o fue movida. Revisa el enlace o vuelve al inicio.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => navigate('/')}>Volver al inicio</Button>
        <Link to="/buscar" className="btn-outline">Buscar viajes</Link>
      </div>
    </div>
  )
}
