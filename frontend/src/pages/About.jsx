import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SearchHero from '../components/SearchHero.jsx'
import PopularRoutes from '../components/PopularRoutes.jsx'
import Benefits from '../components/Benefits.jsx'
import { CIUDADES } from '../components/common/ciudades.js'

const BENEFICIOS = [
  { icono: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', texto: 'Puntualidad y comodidad en tu experiencia de viaje' },
  { icono: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5', texto: 'Variedad de horarios a nuestros diversos destinos' },
  { icono: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h.375c.621 0 1.125-.504 1.125-1.125V11.25c0-1.09-.634-2.028-1.546-2.452M14.25 21a1.5 1.5 0 00-3 0m3 0h.375c.621 0 1.125-.504 1.125-1.125V11.25c0-1.09-.634-2.028-1.546-2.452M18.75 14.25h-2.625a1.5 1.5 0 01-1.5-1.5V5.625A1.875 1.875 0 0012.75 3.75H11.25A1.875 1.875 0 009.375 5.625v7.125c0 .828-.672 1.5-1.5 1.5H5.25', texto: 'Moderna flota con estándares de seguridad' },
  { icono: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z', texto: 'Conductores con amplia experiencia' },
]

const SERVICIOS = [
  {
    titulo: 'Piso 1 — VIP',
    punto: 'bg-navy dark:bg-white',
    texto: 'Asientos de ejecutiva en el primer piso del bus, con más espacio para viajar cómodo.',
  },
  {
    titulo: 'Piso 2 — Estándar',
    punto: 'bg-primary',
    texto: 'Dos filas a cada lado del pasillo, el servicio más usado por su relación precio/comodidad.',
  },
]

const PASOS = [
  { titulo: 'Busca tu viaje', texto: 'Elige origen, destino y, si quieres, la fecha de salida.' },
  { titulo: 'Elige tus asientos', texto: 'Mapa interactivo por piso: ves los ocupados y marcas los tuyos.' },
  { titulo: 'Confirma y paga', texto: 'Revisa el total y completa el pago para reservar tu lugar.' },
  { titulo: 'Recibe tu código', texto: 'Al validar la compra obtienes el código de tu pasaje.' },
]

const SERVICIOS_APP = [
  { titulo: 'Búsqueda por fecha', texto: 'Filtra por día para encontrar el viaje que te sirve.' },
  { titulo: 'Mapa de asientos', texto: 'Pisos VIP y Estándar con los lugares ocupados en tiempo real.' },
  { titulo: 'Precios claros', texto: 'El precio de cada ruta se muestra antes de reservar.' },
  { titulo: 'Control de ventas', texto: 'Los administradores ven buses, rutas y recaudación del día.' },
]

export default function About() {
  const navigate = useNavigate()
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [fechaIda, setFechaIda] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [fechaRetorno, setFechaRetorno] = useState('')
  const [error, setError] = useState('')

  const swap = () => { setOrigen(destino); setDestino(origen) }

  const buscar = (e) => {
    e.preventDefault()
    if (origen.trim().toLowerCase() === destino.trim().toLowerCase()) {
      setError('Origen y destino no pueden ser iguales')
      return
    }
    setError('')
    navigate('/buscar', { state: { origen: origen.trim(), destino: destino.trim(), fecha: fechaIda } })
  }

  const elegirRuta = ({ origen, destino }) => {
    setOrigen(origen)
    setDestino(destino)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <SearchHero
        origen={origen}
        destino={destino}
        fechaIda={fechaIda}
        fechaRetorno={fechaRetorno}
        onOrigen={setOrigen}
        onDestino={setDestino}
        onFechaIda={setFechaIda}
        onFechaRetorno={setFechaRetorno}
        onSwap={swap}
        onSubmit={buscar}
        error={error}
      />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-[30px]">
        <section className="mb-[60px] mt-10 grid grid-cols-1 gap-[30px] md:mt-24 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
          <div>
            <PopularRoutes onSelect={elegirRuta} />
          </div>
          <aside aria-label="Nuestros Beneficios">
            <Benefits />
          </aside>
        </section>

        <section className="px-6 py-12 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-navy dark:text-white md:text-4xl">¿Por qué elegirnos?</h2>
          <div className="mx-auto mt-2 h-1 w-12 bg-orange-500" />
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-4">
            {BENEFICIOS.map(b => (
              <div key={b.texto} className="flex flex-col items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-orange-500/40 bg-orange-50 text-orange-600 dark:border-orange-400/40 dark:bg-orange-500/10 dark:text-orange-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-10 w-10">
                    <path strokeLinecap="round" strokeLinejoin="round" d={b.icono} />
                  </svg>
                </div>
                <p className="mt-4 max-w-[200px] text-sm text-stone-700 dark:text-stone-300">{b.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-black/5 px-6 py-16 dark:border-white/10">
          <h2 className="text-3xl font-semibold tracking-tight text-navy dark:text-white md:text-4xl">Los viajes que hacemos</h2>
          <p className="mt-3 text-base text-stone-600 dark:text-stone-300">Rutas interprovinciales desde y hacia:</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {CIUDADES.map(c => (
              <span key={c} className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm text-navy dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200">
                {c}
              </span>
            ))}
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {SERVICIOS.map(s => (
              <div key={s.titulo} className="card p-6">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.punto}`} aria-hidden />
                  <h3 className="text-base font-semibold text-navy dark:text-white">{s.titulo}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{s.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 border-t border-black/5 px-6 py-16 dark:border-white/10">
          <h2 className="text-3xl font-semibold tracking-tight text-navy dark:text-white md:text-4xl">Cómo funciona</h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map((p, i) => (
              <div key={p.titulo}>
                <span className="text-sm font-medium text-primary">Paso {i + 1}</span>
                <h3 className="mt-1.5 text-base font-semibold text-navy dark:text-white">{p.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{p.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="servicios" className="scroll-mt-24 border-t border-black/5 px-6 py-16 dark:border-white/10">
          <h2 className="text-3xl font-semibold tracking-tight text-navy dark:text-white md:text-4xl">Qué puedes hacer aquí</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {SERVICIOS_APP.map(f => (
              <div key={f.titulo} className="card p-6">
                <h3 className="text-base font-semibold text-navy dark:text-white">{f.titulo}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">{f.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-navy dark:text-white md:text-4xl">¿Listo para viajar?</h2>
          <p className="mt-4 text-lg text-stone-600 dark:text-stone-300">Consulta los viajes disponibles y elige tu asiento en el mapa del bus.</p>
          <div className="mt-8">
            <Link to="/buscar" className="btn-primary">Buscar viajes</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
