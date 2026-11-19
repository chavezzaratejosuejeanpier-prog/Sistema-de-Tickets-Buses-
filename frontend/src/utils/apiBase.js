// Base de la API para axios. Por defecto `/api` en el mismo origen (la API
// de FastAPI sirve el build y /api). Solo se aceptan rutas absolutas del
// propio origen (`/api`, sin query ni fragmento) o URLs https; http solo
// para localhost fuera de producción. En un build de producción nunca se
// acepta una dirección de loopback. Cualquier otro valor vuelve a `/api`.
export const BASE_API_POR_DEFECTO = '/api'

const LOCALES = new Set(['localhost', '127.0.0.1', '[::1]'])

// Hosts de loopback tal como los normaliza WHATWG URL (`hostname`).
export function esLoopback(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    /^127\.\d+\.\d+\.\d+$/.test(host) ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '::' ||
    /^::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}$/.test(host) ||
    /^::ffff:127\./.test(host)
  )
}

// Ruta del propio origen válida: empieza por una sola "/", sin barras
// invertidas, espacios, query ni fragmento.
export function esRutaPropia(texto) {
  return (
    texto.startsWith('/') &&
    !texto.startsWith('//') &&
    !/[\\?#\s]/.test(texto)
  )
}

export function normalizarBaseApi(valor, { produccion = false } = {}) {
  const texto = typeof valor === 'string' ? valor.trim() : ''
  if (!texto) return BASE_API_POR_DEFECTO
  if (texto.startsWith('/')) {
    // "//host" sería una URL de otro origen relativa al protocolo.
    if (!esRutaPropia(texto)) return BASE_API_POR_DEFECTO
    return texto.replace(/\/+$/, '') || BASE_API_POR_DEFECTO
  }
  let url
  try {
    url = new globalThis.URL(texto)
  } catch {
    return BASE_API_POR_DEFECTO
  }
  const permitido =
    url.protocol === 'https:' || (url.protocol === 'http:' && LOCALES.has(url.hostname))
  if (!permitido || url.username || url.password || url.search || url.hash) {
    return BASE_API_POR_DEFECTO
  }
  if (produccion && esLoopback(url.hostname)) return BASE_API_POR_DEFECTO
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}
