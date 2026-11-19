import { useState } from 'react'
import { AuthContext } from './auth-context.js'
import { tokenValido } from '../utils/token.js'
import { borrarSesion, guardarSesion, obtenerToken, obtenerUsuario } from '../utils/sesion.js'

function usuarioGuardado() {
  if (!tokenValido(obtenerToken())) {
    borrarSesion()
    return null
  }
  return obtenerUsuario()
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(usuarioGuardado)

  const login = (userData, token) => {
    guardarSesion(token, userData)
    setUser(userData)
  }
  const logout = () => {
    borrarSesion(); setUser(null)
  }
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}
