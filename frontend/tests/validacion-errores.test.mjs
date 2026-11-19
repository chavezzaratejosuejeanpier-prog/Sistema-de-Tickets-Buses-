// Validación del checkout/registro alineada con el backend y mensajes de
// error como texto plano. Datos sintéticos; sin red ni navegador.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_PASAJEROS_POR_COMPRA,
  bytesUtf8,
  validarPassword,
  validarPasajeros,
} from '../src/utils/validacion.js'
import { mensajeError } from '../src/utils/errores.js'

const HOY = '2026-11-18'

const pasajero = (cambios = {}) => ({
  numero: 1,
  tipo_documento: 'DNI',
  documento: '76543210',
  nombres: 'María José',
  apellido_paterno: 'Pérez',
  apellido_materno: '',
  sexo: 'Femenino',
  fecha_nacimiento: '1995-05-20',
  telefono: '987 654-321',
  ...cambios,
})

const validar = (pasajeros, extra = {}) =>
  validarPasajeros(pasajeros, extra.email ?? 'contacto@example.com', extra.conFactura ?? false, extra.ruc ?? '', HOY)

test('acepta los formatos que el backend admite', () => {
  assert.equal(validar([pasajero()]), null)
  assert.equal(validar([pasajero({ tipo_documento: 'Pasaporte', documento: 'A1234567', nombres: 'John',
    apellido_paterno: "O'Neil", apellido_materno: 'De la Cruz', sexo: 'Masculino', telefono: '+51987654321' })]), null)
  assert.equal(validar([pasajero({ tipo_documento: 'CE', documento: '001234567', nombres: 'Ñuñez Ángel',
    apellido_paterno: 'Quispe-Mamani' })]), null)
  assert.equal(validar([pasajero()], { conFactura: true, ruc: '20123456789' }), null)
})

test('rechaza lo que el backend rechazaría', () => {
  const casos = [
    pasajero({ documento: '1234567' }),
    pasajero({ documento: '1234567A' }),
    pasajero({ tipo_documento: 'CE', documento: '12345' }),
    pasajero({ tipo_documento: 'Pasaporte', documento: 'A12 345' }),
    pasajero({ nombres: 'Ana1' }),
    pasajero({ nombres: '<b>Ana</b>' }),
    pasajero({ nombres: 'A'.repeat(81) }),
    pasajero({ nombres: 'A' }),
    pasajero({ apellido_paterno: '   ' }),
    pasajero({ apellido_materno: 'Pérez2' }),
    pasajero({ sexo: '' }),
    pasajero({ fecha_nacimiento: '2026-11-19' }),
    pasajero({ fecha_nacimiento: '1800-01-01' }),
    pasajero({ telefono: '12' }),
    pasajero({ telefono: '9000abc00' }),
  ]
  for (const p of casos) {
    assert.equal(typeof validar([p]), 'string', JSON.stringify(p))
  }
  assert.match(validar([pasajero()], { email: 'no-es-correo' }), /correo/)
  assert.match(validar([pasajero()], { conFactura: true, ruc: '123' }), /RUC/)
  assert.equal(typeof validar([]), 'string')
  const muchos = Array.from({ length: MAX_PASAJEROS_POR_COMPRA + 1 }, (_, i) => pasajero({ numero: i + 1 }))
  assert.match(validar(muchos), /máximo/)
})

test('contraseña: mínimo 8 caracteres y máximo 72 bytes (bcrypt)', () => {
  assert.equal(typeof validarPassword('corta12'), 'string')
  assert.equal(typeof validarPassword('        '), 'string')
  assert.equal(validarPassword('valida-123'), null)
  assert.equal(bytesUtf8('ñ'), 2)
  assert.equal(bytesUtf8('abc'), 3)
  // 40 caracteres, 80 bytes.
  assert.match(validarPassword('ñ'.repeat(40)), /72 bytes/)
  assert.equal(validarPassword('a'.repeat(72)), null)
  assert.equal(typeof validarPassword(undefined), 'string')
})

test('mensajeError devuelve siempre texto', () => {
  const resp = (status, data) => ({ response: { status, data } })
  assert.equal(mensajeError(resp(409, { detail: 'Asiento 3 ya vendido' })), 'Asiento 3 ya vendido')
  assert.equal(
    mensajeError(resp(422, { detail: [{ msg: 'Campo requerido', loc: ['body', 'email'] }, { msg: 'Otro' }] })),
    'Campo requerido · Otro',
  )
  assert.equal(mensajeError(resp(422, { detail: [{ loc: ['x'] }] }), 'Por defecto'), 'Por defecto')
  assert.equal(mensajeError(resp(400, { detail: { objeto: true } }), 'Por defecto'), 'Por defecto')
  assert.match(mensajeError(resp(429, { detail: 'x' })), /Demasiados intentos/)
  assert.match(mensajeError(resp(500, { detail: 'Traceback interno' })), /servidor/)
  assert.doesNotMatch(mensajeError(resp(500, { detail: 'Traceback interno' })), /Traceback/)
  assert.match(mensajeError({ message: 'Network Error' }), /conectar/)
  assert.equal(mensajeError(resp(400, { detail: 'x'.repeat(2000) })).length, 500)
})
