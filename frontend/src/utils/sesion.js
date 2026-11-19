// Almacenamiento de la sesión (JWT y datos del usuario) en sessionStorage:
// se descarta al cerrar la pestaña y no queda persistido en el perfil del
// navegador. Las sesiones guardadas antes en localStorage se trasladan una
// sola vez (solo si el token sigue vigente) y se borran de localStorage.
import { tokenValido } from './token.js'

const CLAVE_TOKEN = 'token'
const CLAVE_USUARIO = 'user'

function almacen(nombre) {
  try {
    return globalThis[nombre] || null
  } catch {
    // Acceso bloqueado (p. ej. cookies deshabilitadas).
    return null
  }
}

function leer(store, clave) {
  try {
    return store ? store.getItem(clave) : null
  } catch {
    return null
  }
}

function quitar(store, clave) {
  try {
    store?.removeItem(clave)
  } catch {
    // sin almacenamiento disponible
  }
}

// Traslada una sesión heredada de localStorage. Siempre elimina el token y
// el usuario de localStorage, aunque no se trasladen (token vencido o ya
// existe una sesión en esta pestaña).
export function migrarSesionHeredada() {
  const local = almacen('localStorage')
  const sesion = almacen('sessionStorage')
  const tokenViejo = leer(local, CLAVE_TOKEN)
  const usuarioViejo = leer(local, CLAVE_USUARIO)
  if (tokenViejo == null && usuarioViejo == null) return
  try {
    if (sesion && !leer(sesion, CLAVE_TOKEN) && tokenValido(tokenViejo)) {
      sesion.setItem(CLAVE_TOKEN, tokenViejo)
      if (usuarioViejo != null) sesion.setItem(CLAVE_USUARIO, usuarioViejo)
    }
  } catch {
    // cuota o almacenamiento bloqueado: se exige un nuevo inicio de sesión
  } finally {
    quitar(local, CLAVE_TOKEN)
    quitar(local, CLAVE_USUARIO)
  }
}

export function obtenerToken() {
  migrarSesionHeredada()
  return leer(almacen('sessionStorage'), CLAVE_TOKEN)
}

export function obtenerUsuario() {
  migrarSesionHeredada()
  const crudo = leer(almacen('sessionStorage'), CLAVE_USUARIO)
  try {
    return JSON.parse(crudo || 'null')
  } catch {
    return null
  }
}

export function guardarSesion(token, usuario) {
  migrarSesionHeredada()
  const sesion = almacen('sessionStorage')
  if (!sesion) return
  sesion.setItem(CLAVE_TOKEN, token)
  sesion.setItem(CLAVE_USUARIO, JSON.stringify(usuario))
}

export function borrarSesion() {
  const sesion = almacen('sessionStorage')
  quitar(sesion, CLAVE_TOKEN)
  quitar(sesion, CLAVE_USUARIO)
  // Restos de versiones anteriores.
  const local = almacen('localStorage')
  quitar(local, CLAVE_TOKEN)
  quitar(local, CLAVE_USUARIO)
}
