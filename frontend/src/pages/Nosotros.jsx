import { useState } from 'react'
import { Link } from 'react-router-dom'
import busImage from '../assets/bus.avif'

const TABS = [
  {
    id: 'quienes',
    label: 'Quiénes somos',
    titulo: 'Una nueva forma de viajar por el Perú',
    texto: 'LUX - Líneas Únicas Xpress nació para transformar la compra de pasajes interprovinciales. Antes significaba hacer fila en la terminal, sin sistema y sin visibilidad real de los lugares libres. Hoy reunimos en un solo lugar la búsqueda de rutas, el mapa de asientos, el pago y el control interno, con servicios VIP y Estándar, capacidad configurable por bus y cero sobreventa.',
  },
  {
    id: 'mision',
    label: 'Misión',
    titulo: 'Viajes seguros, puntuales y cómodos',
    texto: 'Ofrecer experiencias de viaje interprovincial de nivel premium, combinando una flota moderna, conductores experimentados y tecnología que garantiza puntualidad, seguridad y transparencia en cada reserva. Nuestra misión es que comprar un pasaje sea tan simple como elegir tu asiento.',
  },
  {
    id: 'vision',
    label: 'Visión',
    titulo: 'Ser la referencia del transporte premium',
    texto: 'Convertirnos en la empresa de transporte interprovincial referente del Perú, reconocida por su confiabilidad, su servicio exclusivo y la innovación constante de sus canales digitales, conectando cada vez más destinos sin perder la cercanía con nuestros pasajeros.',
  },
  {
    id: 'valores',
    label: 'Valores',
    titulo: 'Lo que nos define',
    texto: 'Seguridad en cada decisión, puntualidad como compromiso, transparencia en la información y los precios, y un trato cercano que hace sentir a cada pasajero único. Trabajamos con responsabilidad, respeto y pasión por el servicio para que cada viaje con LUX sea memorable.',
  },
]

export default function Nosotros() {
  const [tabActiva, setTabActiva] = useState('quienes')
  const tab = TABS.find(t => t.id === tabActiva)

  return (
    <div className="min-h-full bg-[#121212] text-gray-300">
      <section className="w-full bg-gradient-to-r from-zinc-900 to-[#2e1065] px-6 py-12">
        <div className="mx-auto max-w-shell">
          <nav aria-label="Migas de pan" className="flex items-center gap-2 text-xs font-medium text-gray-400">
            <Link to="/" className="transition-colors hover:text-white">INICIO</Link>
            <span aria-hidden="true">&gt;</span>
            <span className="text-white" aria-current="page">NOSOTROS</span>
          </nav>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white">NOSOTROS</h1>
        </div>
      </section>

      <section className="mx-auto max-w-6xl bg-[#121212] px-4 py-12 sm:px-6">
        <h2 className="text-xl font-bold tracking-tight text-white">LUX - Líneas Únicas Xpress</h2>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-300">
          Somos una empresa de transporte interprovincial que combina experiencia, tecnología y un
          servicio premium para que viajar por el Perú sea simple, seguro y cómodo. Cada ruta, cada
          bus y cada asiento están pensados para que llegues a tu destino sin preocupaciones.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-2 border-b border-white/10 sm:gap-6">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTabActiva(t.id)}
              aria-selected={tabActiva === t.id}
              role="tab"
              className={`-mb-px border-b-4 px-4 py-3 text-sm font-semibold uppercase tracking-wide transition-colors duration-200 ${
                tabActiva === t.id
                  ? 'border-primary text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 overflow-hidden md:grid-cols-2">
          <div className="relative min-h-[280px] md:min-h-[380px]">
            <img
              src={busImage}
              alt="Bus moderno de LUX - Líneas Únicas Xpress"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-zinc-900" aria-hidden="true" />
          </div>
          <div className="flex flex-col justify-center bg-zinc-900 p-8 md:p-12">
            <h3 className="text-2xl font-bold text-white">{tab.titulo}</h3>
            <p className="mt-4 text-base leading-relaxed text-gray-300">{tab.texto}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
