import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Timer } from 'lucide-react'
import Swal from 'sweetalert2'
import Button from '../components/common/Button.jsx'
import { checkout } from '../services/api.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

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
    (inicial?.asientos || []).map(a => ({ asiento_id: a.id, numero: a.number, dni: '', nombres: '' }))
  )
  const [email, setEmail] = useState('')
  const [timeLeft, setTimeLeft] = useState(300)
  const [enviando, setEnviando] = useState(false)
  const [result, setResult] = useState(null)

  const rutaId = inicial?.rutaId
  const precioPorAsiento = Number(inicial?.precio ?? 0)
  const total = pasajeros.length * precioPorAsiento

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
          <div className="mt-6 flex gap-3 justify-center">
            <Link to="/buscar" className="btn-outline">Volver a buscar</Link>
            <Button onClick={() => { try { localStorage.removeItem('reserva') } catch {} navigate('/buscar') }}>Aceptar</Button>
          </div>
        </div>
      </div>
    )
  }

  const handleInputChange = (index, field, value) => {
    const nuevosPasajeros = [...pasajeros]
    nuevosPasajeros[index][field] = value
    setPasajeros(nuevosPasajeros)
  }

  const procesarPago = async (e) => {
    e.preventDefault()
    if (enviando) return

    if (!rutaId) {
      Swal.fire('Sesión expirada', 'Vuelve a buscar tu viaje para continuar.', 'error')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      Swal.fire('Email inválido', 'Ingresa un correo válido para enviarte los pasajes.', 'error')
      return
    }

    for (const p of pasajeros) {
      if (!p.dni || !p.nombres) {
        Swal.fire('Error', 'Todos los campos son obligatorios.', 'error')
        return
      }
      if (p.dni.length !== 8 || Number.isNaN(Number(p.dni))) {
        Swal.fire('DNI Inválido', `El DNI del asiento ${p.numero} debe tener 8 números.`, 'error')
        return
      }
      if (p.nombres.trim().length < 3) {
        Swal.fire('Nombre Inválido', `Ingresa un nombre válido para el asiento ${p.numero}.`, 'error')
        return
      }
    }

    setEnviando(true)
    try {
      const { data } = await checkout({
        route_id: rutaId,
        email: email.trim(),
        pasajeros: pasajeros.map(p => ({
          numero_asiento: p.numero,
          dni: p.dni.trim(),
          nombre: p.nombres.trim()
        }))
      })

      try { localStorage.removeItem('reserva') } catch {}
      await Swal.fire({
        title: '¡Pago Exitoso!',
        html: `
          <p>Tu código de reserva es:</p>
          <p style="font-size:1.6rem;font-weight:800;letter-spacing:.12em;color:#7C3AED;margin:.5rem 0">${data.codigo_reserva}</p>
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
    <div className="max-w-3xl mx-auto">
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
              <div key={pasajero.numero} className="card p-6 relative">
                <span className="badge bg-primary text-white absolute -top-3 left-4">
                  Asiento {pasajero.numero}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label htmlFor={`dni-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      DNI
                    </label>
                    <input
                      id={`dni-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength="8"
                      className="input"
                      placeholder="Ej. 76543210"
                      value={pasajero.dni}
                      onChange={(e) => handleInputChange(index, 'dni', e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div>
                    <label htmlFor={`nombres-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Nombres Completos
                    </label>
                    <input
                      id={`nombres-${index}`}
                      type="text"
                      className="input"
                      placeholder="Ej. Juan Pérez"
                      value={pasajero.nombres}
                      onChange={(e) => handleInputChange(index, 'nombres', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <label htmlFor="email" className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Correo para enviar tus pasajes
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
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
