import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth.js'
import { tokenValido } from '../../utils/token.js'
import { obtenerToken } from '../../utils/sesion.js'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user || !tokenValido(obtenerToken())) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (requiredRole && user.rol !== requiredRole) {
    return <Navigate to="/" replace />
  }
  return children
}