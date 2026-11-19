// Opciones seguras para SweetAlert2. La firma posicional
// Swal.fire(título, texto, icono) asigna el segundo argumento a `html`
// (argsToParams), así que cualquier texto dinámico (mensajes del backend,
// validaciones, detalles de error) se interpretaría como HTML. Con
// `titleText` y `text` SweetAlert2 lo inserta como texto plano.
export function alertaTexto(titulo, texto, icono) {
  const opciones = { titleText: aTexto(titulo), text: aTexto(texto) }
  if (icono) opciones.icon = icono
  return opciones
}

function aTexto(valor) {
  if (valor == null) return ''
  return typeof valor === 'string' ? valor : String(valor)
}
