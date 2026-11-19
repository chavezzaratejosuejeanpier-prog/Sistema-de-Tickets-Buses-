// Pruebas defensivas del frontend: mensajes de SweetAlert2 como texto plano,
// almacenamiento de la sesión en sessionStorage con traslado seguro desde
// localStorage y caducidad del JWT. Datos sintéticos; sin red ni navegador.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { alertaTexto } from '../src/utils/alertas.js'
import { tokenValido } from '../src/utils/token.js'
import {
  borrarSesion,
  guardarSesion,
  migrarSesionHeredada,
  obtenerToken,
  obtenerUsuario,
} from '../src/utils/sesion.js'

// ------------------------------------------------------------- utilidades
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const jwtSintetico = (payload) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.firma-sintetica`
const enSegundos = (delta) => Math.floor(Date.now() / 1000) + delta
const TOKEN_VIGENTE = jwtSintetico({ sub: 'cliente@example.com', exp: enSegundos(3600) })
const TOKEN_VENCIDO = jwtSintetico({ sub: 'cliente@example.com', exp: enSegundos(-60) })
const USUARIO = { email: 'cliente@example.com', rol: 'cliente', nombre: 'Cliente Sintético' }

function crearAlmacen() {
  const datos = new Map()
  return {
    datos,
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => datos.set(k, String(v)),
    removeItem: (k) => datos.delete(k),
  }
}

function instalar(nombre, valor) {
  Object.defineProperty(globalThis, nombre, { value: valor, configurable: true, writable: true })
}

beforeEach(() => {
  instalar('localStorage', crearAlmacen())
  instalar('sessionStorage', crearAlmacen())
})

// -------------------------------------------------- SweetAlert2: solo texto
test('alertaTexto usa titleText/text y nunca title/html', () => {
  const opciones = alertaTexto('Revisa los datos', 'Detalle del servidor', 'error')
  assert.deepEqual(opciones, { titleText: 'Revisa los datos', text: 'Detalle del servidor', icon: 'error' })
  assert.ok(!('html' in opciones))
  assert.ok(!('title' in opciones))
})

test('alertaTexto conserva literalmente texto con marcas y comillas', () => {
  const texto = 'Asiento <3> & "ventana" O\'Brien'
  const opciones = alertaTexto('Título <b>', texto, 'error')
  assert.equal(opciones.text, texto)
  assert.equal(opciones.titleText, 'Título <b>')
})

test('alertaTexto convierte valores no string sin lanzar', () => {
  assert.equal(alertaTexto('t', undefined).text, '')
  assert.equal(alertaTexto('t', null).text, '')
  assert.equal(alertaTexto('t', 409).text, '409')
  assert.ok(!('icon' in alertaTexto('t', 'x')))
})

test('SweetAlert2: la firma posicional asigna el 2.º argumento a html (motivo de alertaTexto)', async (t) => {
  let Swal
  try {
    Swal = (await import('sweetalert2')).default
  } catch {
    t.skip('sweetalert2 no se puede importar fuera del navegador')
    return
  }
  // argsToParams usa `instanceof Element`; en Node basta una clase vacía.
  if (typeof globalThis.Element === 'undefined') instalar('Element', class {})
  const posicional = Swal.argsToParams(['Título', 'Detalle', 'error'])
  assert.equal(posicional.html, 'Detalle')
  assert.ok(!('text' in posicional))
  const seguro = Swal.argsToParams([alertaTexto('Título', 'Detalle', 'error')])
  assert.equal(seguro.text, 'Detalle')
  assert.equal(seguro.titleText, 'Título')
  assert.ok(!('html' in seguro))
  assert.ok(!('title' in seguro))
})

// --------------------------------------------------------- JWT expirado
test('tokenValido rechaza JWT vencido, sin exp, malformado o vacío', () => {
  assert.equal(tokenValido(TOKEN_VIGENTE), true)
  assert.equal(tokenValido(TOKEN_VENCIDO), false)
  assert.equal(tokenValido(jwtSintetico({ sub: 'x' })), false)
  assert.equal(tokenValido(jwtSintetico({ exp: String(enSegundos(3600)) })), false)
  assert.equal(tokenValido('no-es-un-jwt'), false)
  assert.equal(tokenValido('a.%%%.c'), false)
  assert.equal(tokenValido(''), false)
  assert.equal(tokenValido(null), false)
})

// ------------------------------------------------------ sesión en pestaña
test('guardarSesion escribe solo en sessionStorage', () => {
  guardarSesion(TOKEN_VIGENTE, USUARIO)
  assert.equal(sessionStorage.getItem('token'), TOKEN_VIGENTE)
  assert.deepEqual(JSON.parse(sessionStorage.getItem('user')), USUARIO)
  assert.equal(localStorage.getItem('token'), null)
  assert.equal(localStorage.getItem('user'), null)
  assert.equal(obtenerToken(), TOKEN_VIGENTE)
  assert.deepEqual(obtenerUsuario(), USUARIO)
})

test('borrarSesion limpia sessionStorage y restos en localStorage, sin tocar otros datos', () => {
  guardarSesion(TOKEN_VIGENTE, USUARIO)
  localStorage.setItem('token', TOKEN_VIGENTE)
  localStorage.setItem('theme', 'dark')
  localStorage.setItem('reserva', '{"routeId":1}')
  borrarSesion()
  assert.equal(obtenerToken(), null)
  assert.equal(obtenerUsuario(), null)
  assert.equal(localStorage.getItem('token'), null)
  assert.equal(localStorage.getItem('theme'), 'dark')
  assert.equal(localStorage.getItem('reserva'), '{"routeId":1}')
})

test('una sesión heredada vigente se traslada a sessionStorage y sale de localStorage', () => {
  localStorage.setItem('token', TOKEN_VIGENTE)
  localStorage.setItem('user', JSON.stringify(USUARIO))
  assert.equal(obtenerToken(), TOKEN_VIGENTE)
  assert.deepEqual(obtenerUsuario(), USUARIO)
  assert.equal(localStorage.getItem('token'), null)
  assert.equal(localStorage.getItem('user'), null)
})

test('una sesión heredada vencida no se traslada y se elimina', () => {
  localStorage.setItem('token', TOKEN_VENCIDO)
  localStorage.setItem('user', JSON.stringify(USUARIO))
  migrarSesionHeredada()
  assert.equal(sessionStorage.getItem('token'), null)
  assert.equal(sessionStorage.getItem('user'), null)
  assert.equal(localStorage.getItem('token'), null)
  assert.equal(localStorage.getItem('user'), null)
})

test('la migración no sobrescribe la sesión actual de la pestaña', () => {
  const actual = jwtSintetico({ sub: 'otro@example.com', exp: enSegundos(1800) })
  guardarSesion(actual, { ...USUARIO, email: 'otro@example.com' })
  localStorage.setItem('token', TOKEN_VIGENTE)
  localStorage.setItem('user', JSON.stringify(USUARIO))
  assert.equal(obtenerToken(), actual)
  assert.equal(obtenerUsuario().email, 'otro@example.com')
  assert.equal(localStorage.getItem('token'), null)
})

test('usuario guardado corrupto devuelve null sin lanzar', () => {
  sessionStorage.setItem('token', TOKEN_VIGENTE)
  sessionStorage.setItem('user', '{no es json')
  assert.equal(obtenerUsuario(), null)
})

test('almacenamiento bloqueado no rompe la lectura ni el cierre de sesión', () => {
  const bloqueado = {
    getItem() { throw new Error('bloqueado') },
    setItem() { throw new Error('bloqueado') },
    removeItem() { throw new Error('bloqueado') },
  }
  instalar('localStorage', bloqueado)
  instalar('sessionStorage', bloqueado)
  assert.equal(obtenerToken(), null)
  assert.equal(obtenerUsuario(), null)
  assert.doesNotThrow(() => borrarSesion())
  assert.doesNotThrow(() => migrarSesionHeredada())
})
