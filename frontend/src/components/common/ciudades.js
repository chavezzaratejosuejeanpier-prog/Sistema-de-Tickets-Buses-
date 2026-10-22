import { getCiudades } from '../../services/api.js'

let cache = null

// Las ciudades con rutas disponibles las expone el backend: la base de datos es la
// unica fuente de verdad, asi el autocompletado nunca ofrece una ciudad sin buses.
export function cargarCiudades() {
  if (!cache) {
    cache = getCiudades().then(r => r.data).catch(() => [])
  }
  return cache
}

// Autocompletado: filtra por lo que se escribe y saca la ciudad ya elegida en el otro lado.
export function filtrarCiudades(ciudades, query, exclude = '') {
  const q = query.trim().toLowerCase()
  const ex = exclude.trim().toLowerCase()
  return ciudades
    .filter(c => c.toLowerCase().includes(q) && c.toLowerCase() !== ex)
    .slice(0, 8)
}
