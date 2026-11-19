// Contrato de services/api.js: consulta y descarga de boletos autenticadas
// con el header Authorization, sin token en la URL. Usa un adapter falso de
// axios y stubs mínimos de window/document: no hay red, servidor ni navegador.
import { test, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { AxiosError } from 'axios'

const TOKEN = 'token.sintetico.prueba'
let api
let getTicketByCode
let getTicketPdf
let descargarBoletoPdf
let peticiones
let respuestaFalsa
let enlaces
let urlsCreadas
let urlsRevocadas

before(async () => {
  // La sesión (JWT) vive en sessionStorage; localStorage queda para datos
  // no sensibles y para trasladar sesiones heredadas (utils/sesion.js).
  const crearAlmacen = () => {
    const almacen = new Map()
    return {
      getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
      setItem: (k, v) => almacen.set(k, String(v)),
      removeItem: (k) => almacen.delete(k),
    }
  }
  for (const nombre of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, nombre, { value: crearAlmacen(), configurable: true, writable: true })
  }
  globalThis.window = {
    Blob,
    location: { pathname: '/mis-pasajes', href: '/mis-pasajes' },
    URL: {
      createObjectURL: (blob) => {
        urlsCreadas.push(blob)
        return `blob:prueba/${urlsCreadas.length}`
      },
      revokeObjectURL: (url) => urlsRevocadas.push(url),
    },
  }
  globalThis.document = {
    createElement: (tag) => {
      const el = {
        tag,
        clicks: 0,
        removido: false,
        click() { this.clicks += 1 },
        remove() { this.removido = true },
      }
      enlaces.push(el)
      return el
    },
    body: { appendChild: () => {} },
  }

  const modulo = await import('../src/services/api.js')
  api = modulo.default
  getTicketByCode = modulo.getTicketByCode
  getTicketPdf = modulo.getTicketPdf
  descargarBoletoPdf = modulo.descargarBoletoPdf
  api.defaults.adapter = async (config) => {
    peticiones.push(config)
    return respuestaFalsa(config)
  }
})

beforeEach(() => {
  peticiones = []
  enlaces = []
  urlsCreadas = []
  urlsRevocadas = []
  sessionStorage.setItem('token', TOKEN)
  respuestaFalsa = (config) => ({
    data: config.responseType === 'blob' ? new Blob(['%PDF-sintetico'], { type: 'application/pdf' }) : [],
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
})

const autorizacion = (config) => config.headers.get?.('Authorization') ?? config.headers.Authorization
const sinTokenEnUrl = (config) => {
  assert.ok(!config.url.includes(TOKEN))
  assert.equal(config.params, undefined)
}

test('la consulta del boleto envía el token en el header y codifica el código', async () => {
  await getTicketByCode('BC-AB/../12')
  const [config] = peticiones
  assert.equal(config.url, '/sales/tickets/BC-AB%2F..%2F12')
  assert.equal(autorizacion(config), `Bearer ${TOKEN}`)
  sinTokenEnUrl(config)
})

test('el PDF se pide como Blob autenticado, sin token en la URL', async () => {
  const { data } = await getTicketPdf('BC-1234ABCD')
  const [config] = peticiones
  assert.equal(config.url, '/sales/tickets/BC-1234ABCD/pdf')
  assert.equal(config.responseType, 'blob')
  assert.equal(autorizacion(config), `Bearer ${TOKEN}`)
  sinTokenEnUrl(config)
  assert.ok(data instanceof Blob)
})

test('descargarBoletoPdf guarda el Blob con un enlace local y libera la URL', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  await descargarBoletoPdf('BC-1234ABCD')

  const [config] = peticiones
  assert.equal(autorizacion(config), `Bearer ${TOKEN}`)
  sinTokenEnUrl(config)

  assert.equal(urlsCreadas.length, 1)
  assert.ok(urlsCreadas[0] instanceof Blob)
  assert.equal(enlaces.length, 1)
  const [enlace] = enlaces
  assert.equal(enlace.tag, 'a')
  assert.equal(enlace.href, 'blob:prueba/1')
  assert.ok(!enlace.href.includes(TOKEN))
  assert.equal(enlace.download, 'boleto-BC-1234ABCD.pdf')
  assert.equal(enlace.clicks, 1)
  assert.ok(enlace.removido)

  t.mock.timers.tick(1000)
  assert.deepEqual(urlsRevocadas, ['blob:prueba/1'])
})

test('descargarBoletoPdf expone el detalle del 409 de reserva cancelada sin descargar', async () => {
  const detalle = 'La reserva está cancelada: el boleto ya no es válido y no se puede descargar.'
  respuestaFalsa = (config) => {
    const response = {
      data: new Blob([JSON.stringify({ detail: detalle })], { type: 'application/json' }),
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config,
    }
    throw new AxiosError('Conflict', AxiosError.ERR_BAD_REQUEST, config, null, response)
  }
  await assert.rejects(descargarBoletoPdf('BC-CANCELAD'), (err) => {
    assert.equal(err.response.status, 409)
    assert.equal(err.detalle, detalle)
    return true
  })
  assert.equal(urlsCreadas.length, 0)
  assert.equal(enlaces.length, 0)
})
