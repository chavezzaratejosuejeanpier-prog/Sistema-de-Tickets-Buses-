// Ruta interna a la que volver tras iniciar sesión. Solo acepta rutas
// relativas de la SPA ("/checkout"), nunca URLs absolutas ni "//host".
export function destinoSeguro(valor) {
  if (typeof valor !== 'string') return null
  if (!/^\/(?![/\\])[\w/-]*$/.test(valor)) return null
  if (valor.startsWith('/login') || valor.startsWith('/registro')) return null
  return valor
}

// Ruta de retorno tras login: estado del router o ?volver= (lo usa el
// interceptor de 401, que recarga la página y pierde el estado).
export function destinoTrasLogin(location) {
  return (
    destinoSeguro(location?.state?.from) ||
    destinoSeguro(new URLSearchParams(location?.search || '').get('volver'))
  )
}

export function urlLogin(pathname) {
  const volver = destinoSeguro(pathname)
  return volver && volver !== '/' ? `/login?volver=${encodeURIComponent(volver)}` : '/login'
}
