// Continuidad del checkout tras iniciar sesión: la ruta de retorno se
// conserva por estado del router o ?volver= y solo admite rutas internas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { destinoSeguro, destinoTrasLogin, urlLogin } from '../src/utils/destino.js'

test('acepta rutas internas de la SPA', () => {
  assert.equal(destinoSeguro('/checkout'), '/checkout')
  assert.equal(destinoSeguro('/asientos/12'), '/asientos/12')
  assert.equal(destinoSeguro('/mis-pasajes'), '/mis-pasajes')
})

test('rechaza URLs externas, protocolos y bucles de login', () => {
  for (const valor of ['https://externo.example', '//externo.example', '/\\externo.example', 'checkout',
    'javascript:alert(1)', '/checkout?x=1', '/login', '/registro', '', null, undefined, 42]) {
    assert.equal(destinoSeguro(valor), null, String(valor))
  }
})

test('ProtectedRoute desde /checkout vuelve al checkout tras login', () => {
  assert.equal(destinoTrasLogin({ state: { from: '/checkout' }, search: '' }), '/checkout')
})

test('el 401 del interceptor conserva /checkout en ?volver= sin tokens', () => {
  const url = urlLogin('/checkout')
  assert.equal(url, '/login?volver=%2Fcheckout')
  const search = url.slice(url.indexOf('?'))
  assert.equal(destinoTrasLogin({ state: null, search }), '/checkout')
  assert.equal(urlLogin('/'), '/login')
  assert.equal(urlLogin('//externo.example'), '/login')
})

test('?volver= externo se ignora', () => {
  assert.equal(destinoTrasLogin({ state: null, search: '?volver=https%3A%2F%2Fexterno.example' }), null)
  assert.equal(destinoTrasLogin({ state: null, search: '?volver=%2F%2Fexterno.example' }), null)
})
