import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Timer, Check } from 'lucide-react'
import { motion } from 'framer-motion'
import Swal from 'sweetalert2'
import confetti from 'canvas-confetti'
import Button from '../components/common/Button.jsx'
import { checkout, descargarBoletoPdf } from '../services/api.js'
import { useAuth } from '../context/useAuth.js'
import { totalConIGV } from '../utils/precios.js'
import BoletoTermico from '../components/common/BoletoTermico.jsx'
import FirmaDigital from '../components/common/FirmaDigital.jsx'
import { DOCUMENTOS, MAX_LARGO_NOMBRE, docDe, validarPasajeros } from '../utils/validacion.js'
import { mensajeError } from '../utils/errores.js'
import { alertaTexto } from '../utils/alertas.js'

const HOY_ISO = new Date().toISOString().slice(0, 10)

const PASAJERO_VACIO = {
  tipo_documento: 'DNI',
  documento: '',
  nombres: '',
  apellido_paterno: '',
  apellido_materno: '',
  sexo: '',
  fecha_nacimiento: '',
  telefono: '',
}

const CAMPOS_VIAJE = ['origen', 'destino', 'fecha', 'hora', 'placa', 'tipo']

function normalizarViaje(fuente) {
  const v = {}
  for (const campo of CAMPOS_VIAJE) {
    const valor = fuente?.[campo]
    v[campo] = typeof valor === 'string' ? valor : ''
  }
  return v
}

function leerReservaGuardada() {
  try {
    const raw = localStorage.getItem('reserva')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Metadatos guardados solo si pertenecen a la misma ruta (reservas antiguas no traen `viaje`).
function viajeGuardado(rutaId) {
  const r = leerReservaGuardada()
  if (!r || Number(r.routeId) !== Number(rutaId)) return normalizarViaje(null)
  return normalizarViaje(r.viaje)
}

function leerReservaFallback() {
  const r = leerReservaGuardada()
  if (!r) return null
  const nums = Array.isArray(r.asientos) ? r.asientos.filter((n) => Number.isInteger(n)) : []
  if (!r.routeId || nums.length === 0) return null
  return {
    rutaId: Number(r.routeId),
    asientos: nums.map((n) => ({ id: n, number: n })),
    precio: r.precio != null ? Number(r.precio) : null,
    viaje: normalizarViaje(r.viaje),
  }
}

const AVISO_SIMULADO = 'Compra de demostración: el pago es simulado y no se realiza ningún cobro real.'

function escaparHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
}

function formatearFecha(valor) {
  if (!valor) return 'Por confirmar'
  const texto = String(valor)
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00` : texto)
  if (Number.isNaN(d.getTime())) return 'Por confirmar'
  return d.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

const Checkout = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const inicial = useMemo(() => {
    const st = location.state
    if (st?.rutaId && Array.isArray(st?.asientos) && st.asientos.length > 0) {
      const desdeState = normalizarViaje(st)
      const guardado = viajeGuardado(st.rutaId)
      const viaje = {}
      for (const campo of CAMPOS_VIAJE) viaje[campo] = desdeState[campo] || guardado[campo]
      return {
        rutaId: Number(st.rutaId),
        asientos: st.asientos,
        precio: st.precio != null ? Number(st.precio) : null,
        viaje,
      }
    }
    return leerReservaFallback()
  }, [location.state])

  const [pasajeros, setPasajeros] = useState(
    (inicial?.asientos || []).map(a => ({ asiento_id: a.id, numero: a.number, ...PASAJERO_VACIO }))
  )
  // Correo de contacto del boleto; la titularidad la fija el backend con la sesión.
  const [email, setEmail] = useState(() => user?.email || '')
  const [conFactura, setConFactura] = useState(false)
  const [ruc, setRuc] = useState('')
  const [timeLeft, setTimeLeft] = useState(300)
  const [enviando, setEnviando] = useState(false)
  const [result, setResult] = useState(null)
  const [firma, setFirma] = useState(null)
  const [descargando, setDescargando] = useState(false)

  const descargarPdf = async (codigo) => {
    if (descargando) return
    setDescargando(true)
    try {
      await descargarBoletoPdf(codigo)
    } catch (err) {
      if (err.response?.status !== 401) {
        Swal.fire(alertaTexto('No se pudo descargar', err.detalle || 'Intenta de nuevo en un momento.', 'error'))
      }
    } finally {
      setDescargando(false)
    }
  }

  const rutaId = inicial?.rutaId
  const viaje = inicial?.viaje ?? normalizarViaje(null)
  const precioPorAsiento = Number(inicial?.precio ?? 0)
  // La cantidad siempre corresponde a los asientos/pasajeros que se envían al backend.
  const cantidadPasajeros = pasajeros.length
  const total = totalConIGV(precioPorAsiento, cantidadPasajeros)

  const cambiarAsientos = () => {
    if (!rutaId) return
    navigate(`/asientos/${rutaId}`, {
      state: {
        precio: inicial?.precio ?? undefined,
        ...viaje,
      },
    })
  }

  useEffect(() => {
    if (!rutaId) navigate('/buscar', { replace: true })
  }, [rutaId, navigate])

  useEffect(() => {
    if (!inicial) return
    if (timeLeft <= 0) {
      Swal.fire({
        title: 'Tiempo agotado',
        text: 'Tu reserva ha expirado. Vuelve a seleccionar tus asientos.',
        icon: 'warning',
        confirmButtonColor: '#0F172A',
      }).then(() => navigate('/buscar'))
      return
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [timeLeft, navigate, inicial])

  if (!inicial || pasajeros.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-10">
        <div className="empty-state">
          <p className="font-bold text-navy dark:text-white">No hay asientos seleccionados</p>
          <p className="mt-1">Reserva tus asientos antes de continuar al pago.</p>
          <Link to="/buscar" className="btn-primary mt-4">Buscar viajes</Link>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-xl mx-auto p-6 mt-10"
      >
        <div className="card p-8 text-center">
          <h2 className="text-2xl font-bold text-green-600">¡Compra registrada!</h2>
          <p role="note" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            {AVISO_SIMULADO}
          </p>
          <p className="mt-2">Código: <span className="font-mono font-bold">{result.codigo_reserva}</span></p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">Ruta #{rutaId} • Asientos: {result.asientos.join(', ')} • Total: S/ {Number(result.total).toFixed(2)}</p>

          {!firma && (
            <div className="mt-6">
              <FirmaDigital onFirmaCambio={(firmado) => setFirma(firmado)} />
            </div>
          )}

          <div className="mt-6 card p-4">
            <BoletoTermico
              codigoReserva={result.codigo_reserva}
              origen={viaje.origen || '—'}
              destino={viaje.destino || '—'}
              fecha={formatearFecha(viaje.fecha)}
              hora={viaje.hora || '—'}
              asiento={result.asientos.join(', ')}
              precio={Number(result.total)}
              busPlaca={viaje.placa || '—'}
              onDescargar={() => descargarPdf(result.codigo_reserva)}
              descargando={descargando}
              onImprimir={() => window.print()}
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/buscar" className="btn-outline flex-1 text-center">
              Volver a buscar
            </Link>
            <Button onClick={() => { try { localStorage.removeItem('reserva') } catch {} navigate('/buscar') }}>Aceptar</Button>
          </div>
        </div>
      </motion.div>
    )
  }

  const handleInputChange = (index, field, value) => {
    setPasajeros(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const procesarPago = async (e) => {
    e.preventDefault()
    if (enviando) return

    if (!rutaId) {
      Swal.fire(alertaTexto('Sesión expirada', 'Vuelve a buscar tu viaje para continuar.', 'error'))
      return
    }
    const error = validarPasajeros(pasajeros, email, conFactura, ruc, HOY_ISO)
    if (error) {
      Swal.fire(alertaTexto('Revisa los datos', error, 'error'))
      return
    }

    setEnviando(true)
    try {
      const { data } = await checkout({
        route_id: rutaId,
        email: email.trim(),
        ruc: conFactura ? ruc.trim() : null,
        pasajeros: pasajeros.map(p => ({
          numero_asiento: p.numero,
          tipo_documento: p.tipo_documento,
          documento: p.documento.trim(),
          nombres: p.nombres.trim(),
          apellido_paterno: p.apellido_paterno.trim(),
          apellido_materno: p.apellido_materno.trim(),
          sexo: p.sexo,
          fecha_nacimiento: p.fecha_nacimiento || null,
          telefono: p.telefono.trim(),
        })),
      })

      try {
        localStorage.removeItem('reserva')
        localStorage.setItem('ultimaReserva', data.codigo_reserva)
      } catch {}
      await Swal.fire({
        title: '¡Compra registrada!',
        html: `
          <p style="font-size:.85rem;font-weight:700;color:#B45309;margin-bottom:.5rem">${escaparHtml(AVISO_SIMULADO)}</p>
          <p>Tu código de reserva es:</p>
          <p style="font-size:1.6rem;font-weight:800;letter-spacing:.12em;color:#EA580C;margin:.5rem 0">${escaparHtml(data.codigo_reserva)}</p>
          <p style="font-size:.9rem">Consulta tus pasajes desde "Mis Pasajes" con esta misma cuenta. Correo de contacto: ${escaparHtml(data.email)}</p>
        `,
        icon: 'success',
        confirmButtonColor: '#10b981'
      })
      setResult(data)
      try { confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } }) } catch {}
    } catch (error) {
      const status = error.response?.status
      // La firma posicional Swal.fire(título, texto, icono) trata el texto
      // como HTML: alertaTexto lo envía como `text` (texto plano).
      if (status === 401) {
        // El interceptor ya redirige al login conservando el checkout.
      } else if (status === 409) {
        Swal.fire(alertaTexto('Asiento no disponible', mensajeError(error, 'Alguien compró tu asiento. Elige otros.'), 'error'))
      } else if (status === 404) {
        Swal.fire(alertaTexto('Viaje no encontrado', mensajeError(error, 'Este viaje ya no existe.'), 'error'))
      } else if (status === 400 || status === 422) {
        Swal.fire(alertaTexto('Revisa los datos', mensajeError(error, 'Algunos datos no son válidos.'), 'error'))
      } else {
        Swal.fire(alertaTexto('No pudimos registrar tu compra', mensajeError(error, 'Intenta de nuevo.'), 'error'))
      }
    } finally {
      setEnviando(false)
    }
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const urgente = timeLeft <= 60

  const PASOS = ['Búsqueda', 'Asientos', 'Pago', 'Confirmación']
  const pasoActual = result ? 4 : 3

  return (
    <div className="w-full md:w-[70%] mx-auto">
      <ol className="mb-6 flex items-center justify-between gap-2">
        {PASOS.map((p, i) => {
          const n = i + 1
          const done = n < pasoActual
          const active = n === pasoActual
          return (
            <li key={p} className="flex flex-1 items-center gap-2">
              <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold border-2 transition-colors ${done ? 'bg-primary border-primary text-white' : active ? 'border-primary text-primary bg-white dark:bg-stone-900' : 'border-line dark:border-stone-700 text-muted'}`}>
                {done ? <Check size={16} /> : n}
              </span>
              <span className={`hidden sm:block text-xs font-semibold ${active ? 'text-navy dark:text-white' : 'text-muted'}`}>{p}</span>
              {i < PASOS.length - 1 && <span className={`h-0.5 flex-1 ${done ? 'bg-primary' : 'bg-line dark:bg-stone-700'}`} />}
            </li>
          )
        })}
      </ol>
      <div className="card overflow-hidden">
        <div className="bg-navy text-white p-6 flex justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">Completa tu compra</h2>
            <p className="text-sm text-slate-300 mt-1">{pasajeros.length} pasaje(s) reservado(s)</p>
          </div>
          <div
            className={`flex items-center gap-2 bg-white/10 px-4 py-2 rounded-lg font-mono text-xl tabular-nums ${
              urgente ? 'text-red-300' : 'text-white'
            }`}
          >
            <Timer size={20} aria-hidden="true" />
            <span aria-label="Tiempo restante">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <form onSubmit={procesarPago} className="p-6 sm:p-8">
          <div className="space-y-6">
            {pasajeros.map((pasajero, index) => (
              <section
                key={pasajero.numero}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-stone-700 dark:bg-stone-900"
              >
                <div className="rounded-t-lg bg-orange-500 px-4 py-3">
                  <p className="text-sm font-bold tracking-wide text-white">
                    PASAJERO - ASIENTO: {pasajero.numero}
                  </p>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={`tipo-doc-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        Tipo de documento
                      </label>
                      <select
                        id={`tipo-doc-${index}`}
                        className="input"
                        value={pasajero.tipo_documento}
                        onChange={(e) => {
                          const doc = docDe(e.target.value)
                          const valor = doc.digits
                            ? pasajero.documento.replace(/\D/g, '')
                            : pasajero.documento
                          setPasajeros(prev => prev.map((p, i) => (
                            i === index
                              ? { ...p, tipo_documento: doc.value, documento: valor.slice(0, doc.max) }
                              : p
                          )))
                        }}
                      >
                        {DOCUMENTOS.map((d) => (
                          <option key={d.value} value={d.value}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`documento-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        N° documento
                      </label>
                      <input
                        id={`documento-${index}`}
                        type="text"
                        inputMode={docDe(pasajero.tipo_documento).digits ? 'numeric' : 'text'}
                        maxLength={docDe(pasajero.tipo_documento).max}
                        className="input"
                        placeholder={docDe(pasajero.tipo_documento).placeholder}
                        value={pasajero.documento}
                        onChange={(e) => {
                          const doc = docDe(pasajero.tipo_documento)
                          const valor = doc.digits ? e.target.value.replace(/\D/g, '') : e.target.value
                          handleInputChange(index, 'documento', valor.slice(0, doc.max))
                        }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor={`nombres-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        Nombres
                      </label>
                      <input
                        id={`nombres-${index}`}
                        type="text"
                        className="input"
                        placeholder="Nombres Completos"
                        maxLength={MAX_LARGO_NOMBRE}
                        value={pasajero.nombres}
                        onChange={(e) => handleInputChange(index, 'nombres', e.target.value)}
                      />
                    </div>

                    <div>
                      <label htmlFor={`paterno-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        Apellido Paterno
                      </label>
                      <input
                        id={`paterno-${index}`}
                        type="text"
                        className="input"
                        placeholder="Ingrese apellido paterno"
                        maxLength={MAX_LARGO_NOMBRE}
                        value={pasajero.apellido_paterno}
                        onChange={(e) => handleInputChange(index, 'apellido_paterno', e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor={`materno-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        Apellido Materno
                      </label>
                      <input
                        id={`materno-${index}`}
                        type="text"
                        className="input"
                        placeholder="Ingrese apellido materno"
                        maxLength={MAX_LARGO_NOMBRE}
                        value={pasajero.apellido_materno}
                        onChange={(e) => handleInputChange(index, 'apellido_materno', e.target.value)}
                      />
                    </div>

                    <div>
                      <label htmlFor={`sexo-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        Sexo
                      </label>
                      <select
                        id={`sexo-${index}`}
                        className="input"
                        value={pasajero.sexo}
                        onChange={(e) => handleInputChange(index, 'sexo', e.target.value)}
                      >
                        <option value="">Selecciona</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`nacimiento-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        Fecha de nacimiento
                      </label>
                      <input
                        id={`nacimiento-${index}`}
                        type="date"
                        max={HOY_ISO}
                        className="input"
                        value={pasajero.fecha_nacimiento}
                        onChange={(e) => handleInputChange(index, 'fecha_nacimiento', e.target.value)}
                      />
                    </div>

                    <div>
                      <label htmlFor={`telefono-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        Teléfono
                      </label>
                      <input
                        id={`telefono-${index}`}
                        type="tel"
                        inputMode="tel"
                        maxLength={15}
                        className="input"
                        placeholder="Ej. 987654321"
                        value={pasajero.telefono}
                        onChange={(e) => handleInputChange(index, 'telefono', e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor={`email-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                        Email
                      </label>
                      <input
                        id={`email-${index}`}
                        type="email"
                        className="input"
                        placeholder="tu@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      {index === 0 && pasajeros.length > 1 && (
                        <p className="mt-1 text-xs text-muted dark:text-stone-500">
                          El mismo correo para todos los pasajes.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-900">
            <label htmlFor="factura" className="flex items-center gap-3 text-sm font-semibold text-stone-700 dark:text-stone-300">
              <input
                id="factura"
                type="checkbox"
                className="h-4 w-4 accent-orange-500"
                checked={conFactura}
                onChange={(e) => setConFactura(e.target.checked)}
              />
              RUC (Opcional - Factura)
            </label>
            {conFactura && (
              <div className="mt-4 max-w-xs">
                <label htmlFor="ruc" className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  RUC
                </label>
                <input
                  id="ruc"
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  className="input font-mono"
                  placeholder="Ej. 20123456789"
                  value={ruc}
                  onChange={(e) => setRuc(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-stone-700 dark:bg-stone-900">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-stone-700 dark:text-stone-300">Cantidad de pasajeros:</span>
                <span className="font-mono font-bold text-navy dark:text-white w-8 text-center">{cantidadPasajeros}</span>
              </div>
              <button
                type="button"
                onClick={cambiarAsientos}
                className="px-4 py-2 rounded-lg border border-line dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors text-sm font-medium"
              >
                Cambiar asientos
              </button>
            </div>
          </div>

          <div className="mt-8 border-t border-line dark:border-stone-700 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-stone-700 dark:text-stone-300 text-lg text-center md:text-left">
              Total a pagar:{' '}
              <span className="text-2xl font-extrabold text-navy dark:text-white">
                S/ {total.toFixed(2)}
              </span>
            </div>
            <Button type="submit" disabled={enviando} className="w-full md:w-auto">
              {enviando ? (<><span className="spinner" aria-hidden="true" /> Procesando...</>) : 'Confirmar compra (pago simulado)'}
            </Button>
          </div>
          <p role="note" className="mt-3 text-center md:text-right text-xs font-semibold text-amber-700 dark:text-amber-300">
            {AVISO_SIMULADO}
          </p>
        </form>
      </div>
    </div>
  )
}

export default Checkout
