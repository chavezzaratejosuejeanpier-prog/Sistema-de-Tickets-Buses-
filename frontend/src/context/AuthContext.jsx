import { useState } from 'react'
import { AuthContext } from './auth-context.js'
import { tokenValido } from '../utils/token.js'

function usuarioGuardado() {
  const token = localStorage.getItem('token')
  if (!tokenValido(token)) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    return null
  }
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(usuarioGuardado)

  const login = (userData, token) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }
  const logout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null)
  }
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}
