import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Swal from 'sweetalert2'
import Button from '../components/common/Button.jsx'
import { checkout } from '../services/api.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const Checkout = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const rutaId = Number(location.state?.rutaId)
  const asientosSeleccionados = location.state?.asientos || [{ id: 1, number: 14 }]
  const precioPorAsiento = Number(location.state?.precio ?? 45)

  const [pasajeros, setPasajeros] = useState(
    asientosSeleccionados.map(a => ({ asiento_id: a.id, numero: a.number, dni: '', nombres: '' }))
  )
  const [email, setEmail] = useState('')
  const [timeLeft, setTimeLeft] = useState(300)
  const [enviando, setEnviando] = useState(false)

  const total = pasajeros.length * precioPorAsiento

  useEffect(() => {
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
  }, [timeLeft, navigate])

  const handleInputChange = (index, field, value) => {
    const nuevosPasajeros = [...pasajeros]
    nuevosPasajeros[index][field] = value
    setPasajeros(nuevosPasajeros)
  }

  const procesarPago = async (e) => {
    e.preventDefault()

    if (!rutaId) {
      Swal.fire('Sesión expirada', 'Vuelve a buscar tu viaje para continuar.', 'error')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      Swal.fire('Email inválido', 'Ingresa un correo válido para enviarte los pasajes.', 'error')
      return
    }

    for (let p of pasajeros) {
      if (!p.dni || !p.nombres) {
        Swal.fire('Error', 'Todos los campos son obligatorios.', 'error')
        return
      }
      if (p.dni.length !== 8 || isNaN(p.dni)) {
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

      localStorage.removeItem('reserva')
      await Swal.fire({
        title: '¡Pago Exitoso!',
        html: `
          <p>Tu código de reserva es:</p>
          <p style="font-size:1.6rem;font-weight:800;letter-spacing:.12em;color:#FF6B00;margin:.5rem 0">${data.codigo_reserva}</p>
          <p style="font-size:.9rem">Enviamos el detalle a ${data.email}</p>
        `,
        icon: 'success',
        confirmButtonColor: '#10b981'
      })
      navigate('/buscar')
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
            <span aria-hidden="true">⏱️</span>
            <span aria-label="Tiempo restante">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <form onSubmit={procesarPago} className="p-6 sm:p-8">
          <div className="space-y-6">
            {pasajeros.map((pasajero, index) => (
              <div key={index} className="card p-6 relative">
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
                      className="input dark:bg-stone-800 dark:text-white"
                      placeholder="Ej. 76543210"
                      value={pasajero.dni}
                      onChange={(e) => handleInputChange(index, 'dni', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor={`nombres-${index}`} className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
                      Nombres Completos
                    </label>
                    <input
                      id={`nombres-${index}`}
                      type="text"
                      className="input dark:bg-stone-800 dark:text-white"
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
              className="input dark:bg-stone-800 dark:text-white"
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
              {enviando ? 'Procesando...' : 'Confirmar y Pagar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Checkout