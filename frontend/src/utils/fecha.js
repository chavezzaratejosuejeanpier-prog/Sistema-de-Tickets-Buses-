// Fecha de hoy (YYYY-MM-DD) en Lima: el backend valida las búsquedas con el
// calendario de Perú, no con la zona horaria del navegador.
export function hoyLima(ahora = new Date()) {
  try {
    return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })
  } catch {
    // Navegador sin datos de zonas horarias: Perú es UTC-5 todo el año.
    return new Date(ahora.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }
}
