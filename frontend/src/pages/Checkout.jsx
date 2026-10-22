import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Timer, Download } from 'lucide-react'
import Swal from 'sweetalert2'
import Button from '../components/common/Button.jsx'
import { checkout, getPdfUrl } from '../services/api.js'
import { totalConIGV } from '../utils/precios.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const HOY_ISO = new Date().toISOString().slice(0, 10)

const DOCUMENTOS = [
  { value: 'DNI', label: 'DNI', max: 8, min: 8, digits: true, placeholder: 'Ej. 76543210' },
  { value: 'CE', label: 'Carné de extranjería', max: 12, min: 9, digits: false, placeholder: 'Ej. 001234567' },
  { value: 'Pasaporte', label: 'Pasaporte', max: 12, min: 6, digits: false, placeholder: 'Ej. A1234567' },
]

function docDe(valor) {
  return DOCUMENTOS.find((d) => d.value === valor) || DOCUMENTOS[0]
}

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

function validarPasajeros(pasajeros, email, conFactura, ruc) {
  if (!EMAIL_RE.test(email.trim())) {
    return 'Ingresa un correo válido para enviarte los pasajes.'
  }
  for (const p of pasajeros) {
    const asiento = `del asiento ${p.numero}`
    if (!p.nombres.trim() || p.nombres.trim().length < 2) return `Ingresa los nombres ${asiento}.`
    if (!p.apellido_paterno.trim()) return `Ingresa el apellido paterno ${asiento}.`
    if (!p.sexo) return `Selecciona el sexo ${asiento}.`
    if (!p.fecha_nacimiento) return `Ingresa la fecha de nacimiento ${asiento}.`
    if (p.fecha_nacimiento > HOY_ISO) return `La fecha de nacimiento ${asiento} no puede ser futura.`
    const doc = docDe(p.tipo_documento)
    if (!p.documento.trim()) return `Ingresa el documento ${asiento}.`
    if (p.documento.length < doc.min || p.documento.length > doc.max) {
      return `${doc.label} ${asiento} debe tener entre ${doc.min} y ${doc.max} caracteres.`
    }
    if (doc.digits && !/^\d+$/.test(p.documento)) {
      return `${doc.label} ${asiento} solo admite números.`
    }
    if (!/^\+?\d{6,15}$/.test(p.telefono.replace(/[\s-]/g, ''))) {
      return `Ingresa un teléfono válido ${asiento}.`
    }
  }
  if (conFactura && !/^\d{11}$/.test(ruc.trim())) {
    return 'El RUC debe tener 11 números.'
  }
  return null
}

function leerReservaFallback() {
  try {
    const raw = localStorage.getItem('reserva')
    if (!raw) return null
    const r = JSON.parse(raw)
    const nums = Array.isArray(r.asientos) ? r.asientos.filter((n) => Number.isInteger(n)) : []
    if (!r.routeId || nums.length === 0) return null
    return {
      rutaId: Number(r.routeId),
      asientos: nums.map((n) => ({ id: n, number: n })),
      precio: r.precio != null ? Number(r.precio) : null,
    }
  } catch {
    return null
  }
}

const Checkout = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const inicial = useMemo(() => {
    const st = location.state
    if (st?.rutaId && Array.isArray(st?.asientos) && st.asientos.length > 0) {
      return {
        rutaId: Number(st.rutaId),
        asientos: st.asientos,
        precio: st.precio != null ? Number(st.precio) : null,
      }
    }
    return leerReservaFallback()
  }, [location.state])

  const [pasajeros, setPasajeros] = useState(
    (inicial?.asientos || []).map(a => ({ asiento_id: a.id, numero: a.number, ...PASAJERO_VACIO }))
  )
  const [email, setEmail] = useState('')
  const [conFactura, setConFactura] = useState(false)
  const [ruc, setRuc] = useState('')
  const [timeLeft, setTimeLeft] = useState(300)
  const [enviando, setEnviando] = useState(false)
  const [result, setResult] = useState(null)

  const rutaId = inicial?.rutaId
  const precioPorAsiento = Number(inicial?.precio ?? 0)
  const total = totalConIGV(precioPorAsiento, pasajeros.length)

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
      <div className="max-w-xl mx-auto p-6 mt-10">
        <div className="card p-8 text-center">
          <h2 className="text-2xl font-bold text-green-600">¡Compra Exitosa!</h2>
          <p className="mt-2">Código: <span className="font-mono font-bold">{result.codigo_reserva}</span></p>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">Ruta #{rutaId} • Asientos: {result.asientos.join(', ')} • Total: S/ {Number(result.total).toFixed(2)}</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={getPdfUrl(result.codigo_reserva)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-3 text-sm font-bold text-white transition-colors duration-200 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-stone-900"
            >
              <Download size={18} aria-hidden="true" />
              Descargar boleto (PDF)
            </a>
            <Link to="/buscar" className="btn-outline">Volver a buscar</Link>
            <Button onClick={() => { try { localStorage.removeItem('reserva') } catch {} navigate('/buscar') }}>Aceptar</Button>
          </div>
        </div>
      </div>
    )
  }

  const handleInputChange = (index, field, value) => {
    setPasajeros(prev => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const procesarPago = async (e) => {
    e.preventDefault()
    if (enviando) return

    if (!rutaId) {
      Swal.fire('Sesión expirada', 'Vuelve a buscar tu viaje para continuar.', 'error')
      return
    }
    const error = validarPasajeros(pasajeros, email, conFactura, ruc)
    if (error) {
      Swal.fire('Revisa los datos', error, 'error')
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
        title: '¡Pago Exitoso!',
        html: `
          <p>Tu código de reserva es:</p>
          <p style="font-size:1.6rem;font-weight:800;letter-spacing:.12em;color:#EA580C;margin:.5rem 0">${data.codigo_reserva}</p>
          <p style="font-size:.9rem">Guarda este código para consultar tus pasajes. Quedó asociado a ${data.email}</p>
        `,
        icon: 'success',
        confirmButtonColor: '#10b981'
      })
      setResult(data)
    } catch (error) {
      const detalle = error.response?.data?.detail
      const status = error.response?.status
      if (status === 409) {
        Swal.fire('Asiento no disponible', detalle || 'Alguien compró tu asiento. Elige otros.', 'error')
      } else if (status === 404) {
        Swal.fire('Viaje no encontrado', detalle || 'Este viaje ya no existe.', 'error')
      } else {
        Swal.fire('Error de conexión', detalle || 'No pudimos registrar tu compra. Intenta de nuevo.', 'error')
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

  return (
    <div className="w-full md:w-[70%] mx-auto">
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

          <div className="mt-8 border-t border-line dark:border-stone-700 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-stone-700 dark:text-stone-300 text-lg text-center md:text-left">
              Total a pagar:{' '}
              <span className="text-2xl font-extrabold text-navy dark:text-white">
                S/ {total.toFixed(2)}
              </span>
            </div>
            <Button type="submit" disabled={enviando} className="w-full md:w-auto">
              {enviando ? (<><span className="spinner" aria-hidden="true" /> Procesando...</>) : 'Confirmar y Pagar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Checkout
