import { useNavigate } from 'react-router-dom'
import Button from '../components/common/Button.jsx'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="max-w-md mx-auto p-6 text-center mt-10">
      <p className="text-7xl font-black text-primary leading-none">404</p>
      <h1 className="text-2xl font-bold text-navy dark:text-white mt-4">Página no encontrada</h1>
      <p className="text-stone-500 dark:text-stone-400 mt-2 mb-6">
        La ruta que buscas no existe o fue movida. Revisa el enlace o vuelve al inicio.
      </p>
      <Button onClick={() => navigate('/')}>Volver al inicio</Button>
    </div>
  )
}
