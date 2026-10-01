import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SearchHero from '../components/SearchHero.jsx'
import PopularRoutes from '../components/PopularRoutes.jsx'
import Benefits from '../components/Benefits.jsx'
import { CIUDADES } from '../components/common/CityField.jsx'

const SERVICIOS = [
  {
    titulo: 'Piso 1 — VIP',
    punto: 'bg-morado',
    texto: 'Asientos de ejecutiva en el primer piso del bus, con más espacio para viajar cómodo.',
  },
  {
    titulo: 'Piso 2 — Estándar',
    punto: 'bg-accent',
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
  const [origen, setOrigen] = useState('Lima')
  const [destino, setDestino] = useState('Cusco')
  const [fechaIda, setFechaIda] = useState('')
  const [fechaRetorno, setFechaRetorno] = useState('')
  const [pasajeros, setPasajeros] = useState(1)
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

  // Al elegir una ruta popular se rellena el buscador del Hero con la misma lógica de búsqueda
  const elegirRuta = ({ origen, destino }) => {
    setOrigen(origen)
    setDestino(destino)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="mx-auto max-w-6xl">
      <SearchHero
        origen={origen}
        destino={destino}
        fechaIda={fechaIda}
        fechaRetorno={fechaRetorno}
        pasajeros={pasajeros}
        onOrigen={setOrigen}
        onDestino={setDestino}
        onFechaIda={setFechaIda}
        onFechaRetorno={setFechaRetorno}
        onPasajeros={setPasajeros}
        onSwap={swap}
        onSubmit={buscar}
        error={error}
      />

      <section className="mb-[60px] mt-10 grid grid-cols-1 gap-[30px] lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PopularRoutes onSelect={elegirRuta} />
        </div>
        <div>
          <Benefits />
        </div>
      </section>

      <section className="px-6 pt-20 pb-16 text-center">
        <span className="badge bg-accent/10 text-accent">BUSS ConnectPro</span>
        <h1 className="mt-5 text-5xl md:text-6xl font-semibold tracking-tight text-navy">
          Tus viajes por el Perú,
          <br className="hidden sm:block" /> sin colas.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed">
          Reserva tu asiento, paga y viaja. Búsqueda de rutas, mapa del bus, pago y control
          interno en un solo lugar.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to="/buscar" className="btn-accent">Buscar viajes</Link>
          <a href="#como-funciona" className="btn-outline">Cómo funciona</a>
        </div>
      </section>

      <section className="px-6 py-16 border-t border-black/5">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-navy">Quiénes somos</h2>
        <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-stone-600 max-w-3xl">
          <p>
            BUSS ConnectPro nació para resolver una molestia de todos los días: comprar un pasaje
            interprovincial. Antes significaba hacer fila en la terminal, sin sistema y sin
            visibilidad real de los lugares libres.
          </p>
          <p>
            Hoy reunimos en un solo sitio la búsqueda de rutas, el mapa de asientos del bus, el pago
            y el control interno, de modo que pasajero y empresa vean exactamente la misma
            información. Ofrecemos dos servicios: <strong className="text-navy">VIP</strong> (primer
            piso) y <strong className="text-navy">Estándar</strong> (segundo piso), con capacidad
            configurable por bus y sin sobreventa: un asiento ocupado no se puede volver a seleccionar.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 border-t border-black/5">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-navy">Los viajes que hacemos</h2>
        <p className="mt-3 text-[17px] text-stone-600">Rutas interprovinciales desde y hacia:</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {CIUDADES.map(c => (
            <span key={c} className="rounded-full bg-white border border-black/5 px-4 py-2 text-sm text-navy">
              {c}
            </span>
          ))}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SERVICIOS.map(s => (
            <div key={s.titulo} className="card p-6">
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${s.punto}`} aria-hidden />
                <h3 className="font-semibold text-[17px] text-navy">{s.titulo}</h3>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-stone-600">{s.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="como-funciona" className="px-6 py-16 border-t border-black/5">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-navy">Cómo funciona</h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((p, i) => (
            <div key={p.titulo}>
              <span className="text-sm font-medium text-accent">Paso {i + 1}</span>
              <h3 className="mt-1.5 font-semibold text-[17px] text-navy">{p.titulo}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-16 border-t border-black/5">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-navy">Qué puedes hacer aquí</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {SERVICIOS_APP.map(f => (
            <div key={f.titulo} className="card p-6">
              <h3 className="font-semibold text-[17px] text-navy">{f.titulo}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600">{f.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-navy">¿Listo para viajar?</h2>
        <p className="mt-4 text-lg text-stone-600">Consulta los viajes disponibles y elige tu asiento en el mapa del bus.</p>
        <div className="mt-8">
          <Link to="/buscar" className="btn-accent">Buscar viajes</Link>
        </div>
      </section>
    </div>
  )
}
