// Validación de las variables del frontend antes de compilar o servir.
//
// Todo lo que empieza por VITE_ se publica en el JavaScript del navegador.
// Este módulo (usado por vite.config.js y por las pruebas) impide publicar
// por error algo que parezca un secreto y valida los valores de desarrollo
// (DEV_*), que nunca llegan al bundle.

import { esLoopback, esRutaPropia } from './src/utils/apiBase.js'

export const PREFIJO_PUBLICO = 'VITE_'
const PATRON_SECRETO =
  /(SECRET|PASSWORD|PASSWD|PWD|TOKEN|PRIVATE|CLAVE|CONTRASENA|DATABASE|DB_URL|API_KEY|APIKEY|ACCESS_KEY|CREDENTIAL|JWT)/i
const LOCALES = new Set(['localhost', '127.0.0.1', '[::1]'])

function validarApiUrl(valor, produccion) {
  if (valor === undefined || valor === '') return null
  const texto = String(valor).trim()
  if (texto.startsWith('/')) {
    if (!esRutaPropia(texto)) {
      return 'VITE_API_URL debe ser una ruta del mismo origen sin parámetros ni fragmentos (p. ej. /api) o una URL https'
    }
    return null
  }
  let url
  try {
    url = new URL(texto)
  } catch {
    return 'VITE_API_URL debe ser una ruta del mismo origen (p. ej. /api) o una URL https'
  }
  if (url.username || url.password || url.search || url.hash) {
    return 'VITE_API_URL no puede incluir credenciales, parámetros ni fragmentos'
  }
  if (produccion && esLoopback(url.hostname)) {
    return 'VITE_API_URL no puede apuntar a loopback (localhost/127.x/::1) en un build'
  }
  if (url.protocol === 'https:') return null
  if (url.protocol === 'http:' && LOCALES.has(url.hostname) && !produccion) return null
  return 'VITE_API_URL debe usar https (http solo para localhost en desarrollo)'
}

function validarPuerto(nombre, valor) {
  if (valor === undefined || valor === '') return null
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 1 && numero <= 65535
    ? null
    : `${nombre} debe ser un puerto entre 1 y 65535`
}

function validarProxy(valor) {
  if (valor === undefined || valor === '') return null
  try {
    const url = new URL(String(valor))
    if (url.protocol === 'http:' || url.protocol === 'https:') return null
  } catch {
    // mensaje común abajo
  }
  return 'DEV_API_PROXY debe ser una URL http(s), p. ej. http://127.0.0.1:8000'
}

// Devuelve la lista de errores (vacía si todo es válido). Los mensajes
// nombran la variable pero nunca incluyen su valor.
export function erroresEntorno(env, { produccion = false } = {}) {
  const errores = []
  for (const nombre of Object.keys(env)) {
    if (nombre.startsWith(PREFIJO_PUBLICO) && PATRON_SECRETO.test(nombre.slice(PREFIJO_PUBLICO.length))) {
      errores.push(`${nombre} parece un secreto: las variables VITE_* se publican en el navegador`)
    }
  }
  for (const error of [
    validarApiUrl(env.VITE_API_URL, produccion),
    validarProxy(env.DEV_API_PROXY),
    validarPuerto('DEV_PORT', env.DEV_PORT),
    validarPuerto('PREVIEW_PORT', env.PREVIEW_PORT),
  ]) {
    if (error) errores.push(error)
  }
  return errores
}

export function exigirEntornoValido(env, opciones) {
  const errores = erroresEntorno(env, opciones)
  if (errores.length) {
    throw new Error(`Configuración del frontend inválida:\n- ${errores.join('\n- ')}`)
  }
}
