import { useNavigate } from 'react-router-dom'
import Button from '../components/common/Button.jsx'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="max-w-md mx-auto p-6 text-center mt-10">
      <p className="text-6xl font-black text-accent">404</p>
      <h1 className="text-2xl font-bold text-primary mt-4">Página no encontrada</h1>
      <p className="text-slate-500 mt-2 mb-6">La ruta que buscas no existe o fue movida.</p>
      <Button onClick={() => navigate('/')}>Volver al inicio</Button>
    </div>
  )
}