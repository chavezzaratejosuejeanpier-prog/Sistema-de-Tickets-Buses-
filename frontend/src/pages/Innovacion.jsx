import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Bus, Ticket, Clock, Smartphone, Image as ImageIcon, Camera, Monitor, Globe, Trophy, MapPin, Leaf, Sparkles } from 'lucide-react'
import MiembrosCard from '../components/common/MiembrosCard.jsx'
import LogroAnimado from '../components/common/LogroAnimado.jsx'
import MapaCalorPrecios from '../components/common/MapaCalorPrecios.jsx'
import ModoSostenible from '../components/common/ModoSostenible.jsx'
import PortalTransition from '../components/common/PortalTransition.jsx'
import BoletoColeccionable from '../components/common/BoletoColeccionable.jsx'
import VelocidadPanel from '../components/common/VelocidadPanel.jsx'
import ChatIA from '../components/common/ChatIA.jsx'
import ViajeTiempoReal from '../components/common/ViajeTiempoReal.jsx'
import BusquedaImagen from '../components/common/BusquedaImagen.jsx'
import ARBoleto from '../components/common/ARBoleto.jsx'
import Vista360Bus from '../components/common/Vista360Bus.jsx'
import ModoTurista from '../components/common/ModoTurista.jsx'
import KioscoToggle from '../components/common/KioscoToggle.jsx'
import NotificacionesElegantes from '../components/common/NotificacionesElegantes.jsx'
import OLEDToggle from '../components/common/OLEDToggle.jsx'
import PremiumToggle from '../components/common/PremiumToggle.jsx'

const SECCIONES = [
  {
    titulo: 'Sistema de Membresías',
    icono: ShieldCheck,
    color: 'text-stone-600',
    descripcion: 'Planes Plata, Oro y Platino con beneficios visuales distintos.',
    componente: <MiembrosCard plan="oro" activo />,
  },
  {
    titulo: 'Logros Visuales Animados',
    icono: Trophy,
    color: 'text-amber-600',
    descripcion: 'Medallas y trofeos con animación al desbloquearse.',
    componente: (
      <div className="flex gap-3">
        <LogroAnimado titulo="Primera compra" descripcion="Compraste tu primer pasaje" desbloqueado />
        <LogroAnimado titulo="Viajero frecuente" descripcion="5 viajes completados" desbloqueado={false} />
        <LogroAnimado titulo="Explorador" descripcion="Visitaste 3 ciudades diferentes" desbloqueado />
      </div>
    ),
  },
  {
    titulo: 'Mapa de Calor de Precios',
    icono: MapPin,
    color: 'text-emerald-600',
    descripcion: 'Calendario con colores según precio promedio por día.',
    componente: <MapaCalorPrecios fechaSeleccionada={2} onSeleccionarFecha={() => {}} />,
  },
  {
    titulo: 'Viaje Sostenible',
    icono: Leaf,
    color: 'text-green-600',
    descripcion: 'CO₂ ahorrado al tomar bus vs avión, con equivalente en árboles.',
    componente: <ModoSostenible distanciaKm={450} />,
  },
  {
    titulo: 'Transición Portal',
    icono: Sparkles,
    color: 'text-purple-600',
    descripcion: 'Efecto de portal al cambiar entre vistas.',
    componente: (
      <PortalTransition estaActivo>
        <div className="p-4 text-center">
          <p className="text-stone-600 dark:text-stone-400">Contenido revelado mediante portal</p>
        </div>
      </PortalTransition>
    ),
  },
  {
    titulo: 'Boleto Coleccionable',
    icono: Ticket,
    color: 'text-yellow-600',
    descripcion: 'Diseño de tarjeta coleccionable con sello digital y número de serie.',
    componente: <BoletoColeccionable codigo="BC-8842" ruta="Lima → Cusco" fecha="14/11/2026" asiento="12A" numeroSerie="LUX-0042" />,
  },
  {
    titulo: 'Simulador de Velocidad',
    icono: Clock,
    color: 'text-orange-600',
    descripcion: 'Ajuste la velocidad del bus y vea el tiempo estimado de llegada.',
    componente: <VelocidadPanel distanciaKm={300} />,
  },
  {
    titulo: 'Asistente de IA (Chat)',
    icono: Smartphone,
    color: 'text-blue-600',
    descripcion: 'Chat conversacional para consultar rutas, precios y ayuda.',
    componente: <ChatIA />,
  },
  {
    titulo: 'Viaje en Tiempo Real',
    icono: Bus,
    color: 'text-indigo-600',
    descripcion: 'Animación del bus recorriendo la ruta con progreso y ETA.',
    componente: <ViajeTiempoReal progreso={45} origen="Lima" destino="Cusco" />,
  },
  {
    titulo: 'Búsqueda por Imagen',
    icono: ImageIcon,
    color: 'text-violet-600',
    descripcion: 'Suba una foto de un destino y la app sugerirá rutas similares.',
    componente: <BusquedaImagen />,
  },
  {
    titulo: 'Realidad Aumentada',
    icono: Camera,
    color: 'text-cyan-600',
    descripcion: 'Escanee su boleto con la cámara para validar en AR.',
    componente: <ARBoleto codigo="BC-8842" />,
  },
  {
    titulo: 'Vista 360° del Bus',
    icono: Monitor,
    color: 'text-stone-600',
    descripcion: 'Recorra el interior del bus antes de comprar (prototipo).',
    componente: <Vista360Bus />,
  },
  {
    titulo: 'Modo Turista',
    icono: Globe,
    color: 'text-rose-600',
    descripcion: 'Recomienda destinos según clima y hora del día.',
    componente: <ModoTurista />,
  },
]

export default function Innovacion() {
  const [modoCompacto, setModoCompacto] = useState(false)
  const [modoOLED, setModoOLED] = useState(false)
  const [modoPremium, setModoPremium] = useState(false)

  return (
    <div className="min-h-screen bg-surface dark:bg-stone-950">
      <header className="border-b border-line dark:border-stone-700 bg-white/80 dark:bg-stone-900/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Bus size={24} className="text-primary" aria-hidden="true" />
              <span className="font-black text-2xl tracking-tight text-navy dark:text-white">LUX Innovaciones</span>
            </div>
            <Link to="/" className="btn-ghost">Volver al inicio</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-navy dark:text-white tracking-tight mb-2">
            Mejoras de Diseño Innovador
          </h1>
          <p className="text-stone-600 dark:text-stone-400">
            Explore las nuevas experiencias de usuario disponibles en la rama <code className="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded text-xs">estilos</code>.
          </p>
        </div>

        {/* Controles de modo visual */}
        <div className="flex flex-wrap gap-3 mb-6">
          <KioscoToggle activo={modoCompacto} onCambiar={setModoCompacto} />
          <OLEDToggle activo={modoOLED} onCambiar={setModoOLED} />
          <PremiumToggle activo={modoPremium} onCambiar={setModoPremium} />
          <NotificacionesElegantes />
        </div>

        <div className="grid grid-cols-1 gap-6">
          {SECCIONES.map((s, i) => (
            <section key={i} className="rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900 shadow-soft overflow-hidden">
              <div className="p-4 border-b border-line dark:border-stone-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full ${s.color} flex items-center justify-center`}>
                    <s.icono size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-navy dark:text-white">{s.titulo}</h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">{s.descripcion}</p>
                  </div>
                </div>
                <Link
                  to="#"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Probar →
                </Link>
              </div>
              <div className="p-4">{s.componente}</div>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}