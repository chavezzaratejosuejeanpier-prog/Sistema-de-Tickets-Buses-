import { useEffect, useState } from 'react'
import { Ticket as TicketIcon, Bus, CalendarDays, Search } from 'lucide-react'
import Button from '../components/common/Button.jsx'
import { getTicketByCode } from '../services/api.js'

const formatoFecha = (iso) => {
  if (!iso) return 'Fecha no disponible'
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function MisPasajes() {
  const [codigo, setCodigo] = useState(() => localStorage.getItem('ultimaReserva') || '')
  const [tickets, setTickets] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const guardado = localStorage.getItem('ultimaReserva')
    if (guardado) consultar(guardado)
  }, [])

  const consultar = async (codigoBuscado) => {
    const limpio = codigoBuscado.trim().toUpperCase()
    if (!limpio) {
      setError('Ingresa el código de reserva que te dimos al comprar.')
      setTickets(null)
      return
    }
    setCargando(true)
    setError('')
    try {
      const { data } = await getTicketByCode(limpio)
      setTickets(data)
      localStorage.setItem('ultimaReserva', limpio)
      setCodigo(limpio)
    } catch (err) {
      setTickets(null)
      localStorage.removeItem('ultimaReserva')
      setError(
        err.response?.status === 404
          ? `No encontramos una reserva con el código ${limpio}. Revísalo e inténtalo de nuevo.`
          : 'No pudimos consultar la reserva. Inténtalo en un momento.'
      )
    } finally {
      setCargando(false)
    }
  }

  const total = tickets?.reduce((suma, t) => suma + (t.precio_pagado || 0), 0) || 0
  const viaje = tickets?.[0]

  return (
    <div className="max-w-3xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-navy dark:text-white">Mis Pasajes</h1>
        <p className="text-muted dark:text-stone-400 mt-2">
          Ingresa tu código de reserva para ver tus pasajes.
        </p>
      </header>

      <form
        onSubmit={(e) => { e.preventDefault(); consultar(codigo) }}
        className="card p-5 sm:p-6"
      >
        <label htmlFor="codigo" className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">
          Código de reserva
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="BC-XXXXXXXX"
            className="input font-mono tracking-widest dark:bg-stone-800 dark:text-white"
            autoComplete="off"
          />
          <Button type="submit" disabled={cargando} className="w-full sm:w-auto shrink-0">
            <Search size={18} aria-hidden="true" />
            {cargando ? 'Buscando...' : 'Consultar'}
          </Button>
        </div>
        <p className="text-xs text-muted dark:text-stone-500 mt-3">
          El código empieza con <span className="font-mono">BC-</span> y te lo mostramos al confirmar la compra.
        </p>
      </form>

      {cargando && (
        <div className="mt-8 flex items-center justify-center gap-3 text-muted">
          <span className="spinner" aria-hidden="true" /> Consultando reserva...
        </div>
      )}

      {error && !cargando && (
        <div className="mt-8 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-5 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {!error && !cargando && tickets && (
        <div className="mt-8 space-y-4">
          {viaje?.origen && (
            <div className="card p-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 font-bold text-navy dark:text-white">
                {viaje.origen} <span className="text-primary">→</span> {viaje.destino}
              </span>
              <span className="inline-flex items-center gap-2 text-muted dark:text-stone-400">
                <CalendarDays size={16} aria-hidden="true" />
                {formatoFecha(viaje.fecha_salida)} · {viaje.hora_salida}
              </span>
              {viaje.bus_placa && (
                <span className="inline-flex items-center gap-2 text-muted dark:text-stone-400">
                  <Bus size={16} aria-hidden="true" /> {viaje.bus_placa}
                </span>
              )}
            </div>
          )}

          {tickets.map(t => (
            <div key={t.id} className="card p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary">
                  <TicketIcon size={22} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-bold text-navy dark:text-white">{t.pasajero_nombre || 'Pasajero'}</p>
                  <p className="text-sm text-muted dark:text-stone-400">
                    Asiento <span className="font-semibold text-primary">{t.numero_asiento}</span> · Piso {t.piso}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="badge bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  {t.estado}
                </span>
                <p className="text-sm font-semibold text-navy dark:text-white mt-1.5">
                  S/ {(t.precio_pagado || 0).toFixed(2)}
                </p>
              </div>
            </div>
          ))}

          <div className="card p-5 flex flex-wrap items-center justify-between gap-4 border-primary/40">
            <span className="font-semibold text-navy dark:text-white">Total pagado</span>
            <span className="text-2xl font-extrabold text-primary">S/ {total.toFixed(2)}</span>
          </div>

          <p className="text-xs text-muted dark:text-stone-500 text-center">
            ¿Perdiste el código? Puedes buscarlo en el correo con el que compraste.
          </p>
        </div>
      )}

      {!error && !cargando && !tickets && (
        <div className="empty-state mt-8">
          Aún no has consultado ninguna reserva. Escribe tu código <span className="font-mono">BC-...</span> arriba.
        </div>
      )}
    </div>
  )
}