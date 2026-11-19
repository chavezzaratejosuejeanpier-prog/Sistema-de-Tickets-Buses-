// Convierte un error de axios en un mensaje de texto para el usuario.
// El backend responde `detail` como texto; versiones previas o FastAPI por
// defecto pueden enviar una lista de errores de validación (422). Nunca
// devuelve objetos ni HTML: el resultado se muestra como texto plano.
export function mensajeError(err, porDefecto = 'Ocurrió un error. Inténtalo de nuevo.') {
  if (!err?.response) return 'No se pudo conectar con el servidor. Verifica tu conexión.'
  const { status, data } = err.response
  if (status === 429) {
    return 'Demasiados intentos. Espera un momento antes de volver a intentarlo.'
  }
  if (status === 413) return 'La solicitud es demasiado grande.'
  if (status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.'
  const detalle = data?.detail
  if (typeof detalle === 'string' && detalle.trim()) return detalle.trim().slice(0, 500)
  if (Array.isArray(detalle) && detalle.length > 0) {
    const textos = detalle
      .map((d) => (typeof d === 'string' ? d : typeof d?.msg === 'string' ? d.msg : ''))
      .filter(Boolean)
    if (textos.length) return textos.join(' · ').slice(0, 500)
  }
  return porDefecto
}
