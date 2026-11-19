// Incrementar la versión al cambiar la lista de recursos para invalidar cachés anteriores.
// El servidor entrega este archivo con Cache-Control: no-cache y el registro
// usa updateViaCache: 'none', así cada publicación se detecta al navegar.
const CACHE_PREFIX = 'lux-v'
const CACHE_NAME = `${CACHE_PREFIX}3`
// Nunca se interceptan ni se guardan: API (datos personales y boletos) y sondas.
const RUTAS_EXCLUIDAS = ['/api', '/health']
// Solo recursos estáticos que existen en /public. No se precachea HTML.
const ASSETS = [
  '/manifest.json',
  '/favicon.svg',
]

const OFFLINE_HTML = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sin conexión | LUX</title>
  </head>
  <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0F172A;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px">
    <div>
      <h1 style="font-size:1.5rem;margin:0 0 .5rem">Sin conexión</h1>
      <p style="margin:0 0 1rem;color:#cbd5e1">No pudimos cargar LUX. Revisa tu conexión e inténtalo de nuevo.</p>
      <button onclick="location.reload()" style="background:#FF6B00;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-weight:600;cursor:pointer">Reintentar</button>
    </div>
  </body>
</html>`

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (RUTAS_EXCLUIDAS.some((r) => url.pathname === r || url.pathname.startsWith(`${r}/`))) return

  // Navegación: siempre red primero; sin red, página offline explícita.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => new Response(OFFLINE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }))
    )
    return
  }

  // Recursos precacheados (manifest/icono): red primero; sin red, la copia del precache estático.
  // No se escribe en caché durante fetch.
  if (ASSETS.includes(url.pathname)) {
    e.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE_NAME)
          .then((cache) => cache.match(url.pathname))
          .then((res) => res || Response.error())
      )
    )
  }
  // Resto de peticiones: no se interceptan.
})
