import { getCiudades } from '../../services/api.js'

let cache = null

export function cargarCiudades() {
  if (!cache) {
    cache = getCiudades().then(r => r.data).catch(() => [])
  }
  return cache
}

export function filtrarCiudades(ciudades, query, exclude = '') {
  const q = query.trim().toLowerCase()
  const ex = exclude.trim().toLowerCase()
  return ciudades.filter(c => c.toLowerCase().includes(q) && c.toLowerCase() !== ex)
}
