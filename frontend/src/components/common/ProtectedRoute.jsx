import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth.js'

export default function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (requiredRole && user.rol !== requiredRole) {
    return <Navigate to="/" replace />
  }
  return children
}