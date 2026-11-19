// Reglas de validación del navegador. Deben coincidir con el backend:
// backend/app/schemas/ticket_schema.py (pasajeros) y
// backend/app/schemas/user_schema.py / core/security.py (contraseñas).

export const MAX_PASAJEROS_POR_COMPRA = 60
export const MAX_LARGO_NOMBRE = 80
export const MIN_LARGO_PASSWORD = 8
export const MAX_BYTES_PASSWORD = 72

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Letras (con tildes y ñ), espacios, apóstrofo, punto y guion.
const NOMBRE_RE = /^[\p{L} '.\-’]+$/u

export const DOCUMENTOS = [
  { value: 'DNI', label: 'DNI', max: 8, min: 8, digits: true, placeholder: 'Ej. 76543210' },
  { value: 'CE', label: 'Carné de extranjería', max: 12, min: 9, digits: false, placeholder: 'Ej. 001234567' },
  { value: 'Pasaporte', label: 'Pasaporte', max: 12, min: 6, digits: false, placeholder: 'Ej. A1234567' },
]

export function docDe(valor) {
  return DOCUMENTOS.find((d) => d.value === valor) || DOCUMENTOS[0]
}

// Bytes UTF-8 sin depender de TextEncoder.
export function bytesUtf8(texto) {
  try {
    return encodeURIComponent(String(texto ?? '')).replace(/%[0-9A-F]{2}/gi, 'x').length
  } catch {
    return Infinity
  }
}

export function validarPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_LARGO_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_LARGO_PASSWORD} caracteres.`
  }
  if (!password.trim()) return 'La contraseña no puede estar vacía.'
  if (bytesUtf8(password) > MAX_BYTES_PASSWORD) {
    return 'La contraseña es demasiado larga (máximo 72 bytes).'
  }
  return null
}

function validarNombre(valor, etiqueta, asiento, { obligatorio = true, minimo = 1 } = {}) {
  const limpio = String(valor ?? '').trim().replace(/\s+/g, ' ')
  if (!limpio) return obligatorio ? `Ingresa ${etiqueta} ${asiento}.` : null
  if (limpio.length < minimo || limpio.length > MAX_LARGO_NOMBRE) {
    return `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} ${asiento} debe tener entre ${minimo} y ${MAX_LARGO_NOMBRE} caracteres.`
  }
  if (!NOMBRE_RE.test(limpio) || !/\p{L}/u.test(limpio)) {
    return `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} ${asiento} solo admite letras, espacios, apóstrofo, punto y guion.`
  }
  return null
}

export function validarPasajeros(pasajeros, email, conFactura, ruc, hoyIso = new Date().toISOString().slice(0, 10)) {
  if (!EMAIL_RE.test(String(email ?? '').trim()) || String(email).trim().length > 254) {
    return 'Ingresa un correo válido para enviarte los pasajes.'
  }
  if (!Array.isArray(pasajeros) || pasajeros.length === 0) return 'Elige al menos un asiento.'
  if (pasajeros.length > MAX_PASAJEROS_POR_COMPRA) {
    return `Puedes comprar como máximo ${MAX_PASAJEROS_POR_COMPRA} pasajes por operación.`
  }
  for (const p of pasajeros) {
    const asiento = `del asiento ${p.numero}`
    const error =
      validarNombre(p.nombres, 'los nombres', asiento, { minimo: 2 }) ||
      validarNombre(p.apellido_paterno, 'el apellido paterno', asiento) ||
      validarNombre(p.apellido_materno, 'el apellido materno', asiento, { obligatorio: false })
    if (error) return error
    if (!p.sexo) return `Selecciona el sexo ${asiento}.`
    if (!p.fecha_nacimiento) return `Ingresa la fecha de nacimiento ${asiento}.`
    if (p.fecha_nacimiento > hoyIso) return `La fecha de nacimiento ${asiento} no puede ser futura.`
    if (p.fecha_nacimiento < '1900-01-01') return `Revisa la fecha de nacimiento ${asiento}.`
    const doc = docDe(p.tipo_documento)
    const documento = String(p.documento ?? '').trim()
    if (!documento) return `Ingresa el documento ${asiento}.`
    if (documento.length < doc.min || documento.length > doc.max) {
      return `${doc.label} ${asiento} debe tener entre ${doc.min} y ${doc.max} caracteres.`
    }
    if (doc.digits ? !/^\d+$/.test(documento) : !/^[A-Za-z0-9-]+$/.test(documento)) {
      return doc.digits
        ? `${doc.label} ${asiento} solo admite números.`
        : `${doc.label} ${asiento} solo admite letras, números y guion.`
    }
    if (!/^\+?\d{6,15}$/.test(String(p.telefono ?? '').replace(/[\s()-]/g, ''))) {
      return `Ingresa un teléfono válido ${asiento}.`
    }
  }
  if (conFactura && !/^\d{11}$/.test(String(ruc ?? '').trim())) {
    return 'El RUC debe tener 11 números.'
  }
  return null
}
