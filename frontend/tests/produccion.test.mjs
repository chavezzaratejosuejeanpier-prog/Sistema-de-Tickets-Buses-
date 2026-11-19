// Preparación para producción del frontend: base de la API en el mismo
// origen, variables públicas sin secretos y PWA (manifest y service worker
// sin caché de /api). Sin red, servidor ni navegador; datos sintéticos.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { normalizarBaseApi, BASE_API_POR_DEFECTO } from '../src/utils/apiBase.js'
import { erroresEntorno, exigirEntornoValido } from '../entorno-publico.mjs'

test('la base de la API es /api salvo rutas propias o https', () => {
  assert.equal(BASE_API_POR_DEFECTO, '/api')
  for (const valor of [undefined, null, '', '   ', 42]) {
    assert.equal(normalizarBaseApi(valor), '/api')
  }
  assert.equal(normalizarBaseApi('/api/'), '/api')
  assert.equal(normalizarBaseApi(' /v2/api '), '/v2/api')
  assert.equal(normalizarBaseApi('https://api.example.com/'), 'https://api.example.com')
  assert.equal(normalizarBaseApi('http://localhost:8000/api'), 'http://localhost:8000/api')
  for (const inseguro of [
    '//atacante.example/api',
    '/\\atacante.example',
    'http://api.example.com',
    'javascript:alert(1)',
    'https://usuario:clave@api.example.com',
    'https://api.example.com/api?x=1',
    'no es url',
  ]) {
    assert.equal(normalizarBaseApi(inseguro), '/api', inseguro)
  }
})

test('rutas relativas con query o fragmento y loopback en producción vuelven a /api', () => {
  for (const relativa of ['/api?x=1', '/api#frag', '/api/?debug=1', '/a pi']) {
    assert.equal(normalizarBaseApi(relativa), '/api', relativa)
    assert.equal(erroresEntorno({ VITE_API_URL: relativa }).length, 1, relativa)
  }
  for (const loopback of [
    'http://localhost:8000/api',
    'https://localhost/api',
    'https://127.0.0.2/api',
    'https://[::1]/api',
    'https://app.localhost/api',
    'https://0x7f.1/api',
  ]) {
    assert.equal(normalizarBaseApi(loopback, { produccion: true }), '/api', loopback)
    assert.equal(erroresEntorno({ VITE_API_URL: loopback }, { produccion: true }).length, 1, loopback)
  }
  assert.equal(normalizarBaseApi('https://api.example.com/', { produccion: true }), 'https://api.example.com')
  assert.equal(normalizarBaseApi('/api', { produccion: true }), '/api')
})

test('vite.config valida como producción todo build, sea cual sea el modo', async () => {
  const { default: fabrica } = await import('../vite.config.js')
  const anterior = process.env.VITE_API_URL
  process.env.VITE_API_URL = 'http://localhost:8000/api'
  try {
    assert.throws(() => fabrica({ command: 'build', mode: 'staging' }), /VITE_API_URL/)
    assert.throws(() => fabrica({ command: 'build', mode: 'development' }), /VITE_API_URL/)
    assert.doesNotThrow(() => fabrica({ command: 'serve', mode: 'development' }))
  } finally {
    if (anterior === undefined) delete process.env.VITE_API_URL
    else process.env.VITE_API_URL = anterior
  }
})

test('el build rechaza variables VITE_* con aspecto de secreto sin mostrar su valor', () => {
  const valor = 'valor-sintetico-que-no-debe-aparecer'
  const errores = erroresEntorno({
    VITE_SECRET_KEY: valor,
    VITE_DATABASE_URL: valor,
    VITE_API_TOKEN: valor,
    VITE_STRIPE_API_KEY: valor,
    SECRET_KEY: valor, // sin prefijo: no se publica, se ignora
    VITE_API_URL: '/api',
  })
  assert.equal(errores.length, 4)
  assert.ok(errores.every((e) => !e.includes(valor)))
  assert.throws(() => exigirEntornoValido({ VITE_JWT: 'x' }), /VITE_JWT/)
  assert.deepEqual(erroresEntorno({ VITE_API_URL: '/api', VITE_APP_NOMBRE: 'LUX' }), [])
})

test('VITE_API_URL y opciones de desarrollo validadas', () => {
  assert.deepEqual(erroresEntorno({ VITE_API_URL: 'https://api.example.com' }, { produccion: true }), [])
  assert.equal(erroresEntorno({ VITE_API_URL: 'http://localhost:8000/api' }, { produccion: true }).length, 1)
  assert.deepEqual(erroresEntorno({ VITE_API_URL: 'http://localhost:8000/api' }), [])
  assert.equal(erroresEntorno({ VITE_API_URL: '//atacante.example' }).length, 1)
  assert.equal(erroresEntorno({ VITE_API_URL: 'https://u:p@api.example.com' }).length, 1)
  assert.deepEqual(erroresEntorno({ DEV_API_PROXY: 'http://127.0.0.1:8000', DEV_PORT: '5173' }), [])
  assert.equal(erroresEntorno({ DEV_API_PROXY: 'ftp://x', DEV_PORT: '99999', PREVIEW_PORT: 'abc' }).length, 3)
})

test('el manifest PWA es válido y del propio origen', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'))
  assert.equal(manifest.start_url, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.id, '/')
  assert.equal(manifest.display, 'standalone')
  assert.ok(manifest.icons.length >= 1)
  for (const icono of manifest.icons) {
    assert.ok(icono.src.startsWith('/'), icono.src)
  }
})

// Ejecuta sw.js en un contexto aislado con stubs mínimos y devuelve sus
// manejadores para comprobar qué intercepta.
function cargarServiceWorker() {
  const manejadores = {}
  const self = {
    location: { origin: 'https://lux.example' },
    addEventListener: (tipo, fn) => { manejadores[tipo] = fn },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  }
  const contexto = {
    self,
    URL,
    Response: class { constructor(cuerpo, opciones) { this.cuerpo = cuerpo; this.opciones = opciones } },
    caches: { open: async () => ({ addAll: async () => {}, match: async () => null }), keys: async () => [] },
    fetch: () => Promise.resolve('red'),
  }
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), contexto)
  return manejadores
}

test('el service worker nunca intercepta /api ni /health', () => {
  const { fetch: alPedir } = cargarServiceWorker()
  const respondidas = []
  const evento = (url, mode = 'cors', method = 'GET') => ({
    request: { url, mode, method },
    respondWith: (r) => respondidas.push([url, r]),
  })
  for (const url of [
    'https://lux.example/api/sales/tickets/BC-SINTETICO',
    'https://lux.example/api',
    'https://lux.example/health/ready',
  ]) {
    alPedir(evento(url, 'navigate'))
    alPedir(evento(url))
  }
  assert.deepEqual(respondidas, [])
  alPedir(evento('https://lux.example/checkout', 'navigate'))
  alPedir(evento('https://lux.example/manifest.json'))
  assert.equal(respondidas.length, 2)
  alPedir(evento('https://lux.example/api/sales/checkout', 'cors', 'POST'))
  assert.equal(respondidas.length, 2)
})
