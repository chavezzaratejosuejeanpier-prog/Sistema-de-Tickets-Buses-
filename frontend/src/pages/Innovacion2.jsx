import { Link } from 'react-router-dom'
import { Bus, Sparkles, Leaf, Sun, MapPin, Snowflake, Clock, Mail, ShieldCheck, Palette as PaletteIcon, Film, Layers, Globe, Monitor } from 'lucide-react'
import DaltonismoFilter from '../components/common/DaltonismoFilter.jsx'
import GlassWetButton from '../components/common/GlassWetButton.jsx'
import SnowEffect from '../components/common/SnowEffect.jsx'
import WaveEffect from '../components/common/WaveEffect.jsx'
import VozOndas from '../components/common/VozOndas.jsx'
import OfertaLimitada from '../components/common/OfertaLimitada.jsx'
import ImánButton from '../components/common/ImánButton.jsx'
import Estaciones from '../components/common/Estaciones.jsx'
import MetalicaCard from '../components/common/MetalicaCard.jsx'
import ProgresoCircular from '../components/common/ProgresoCircular.jsx'
import ModoFoco from '../components/common/ModoFoco.jsx'
import MaquinaEscribir from '../components/common/MaquinaEscribir.jsx'
import FondosGeometricos from '../components/common/FondosGeometricos.jsx'
import CapasCard from '../components/common/CapasCard.jsx'
import LecturaNocturna from '../components/common/LecturaNocturna.jsx'
import CortinaTransition from '../components/common/CortinaTransition.jsx'
import AsientosIsometricos from '../components/common/AsientosIsometricos.jsx'
import PanelConfig from '../components/common/PanelConfig.jsx'

const SECCIONES = [
  {
    titulo: 'Filtros de Daltonismo',
    icono: ShieldCheck,
    color: 'text-stone-600',
    descripcion: 'Aplica filtros de protanopia, deuteranopia o tritanopia sobre toda la interfaz.',
    componente: <DaltonismoFilter />,
  },
  {
    titulo: 'Vidrio Húmedo',
    icono: Sparkles,
    color: 'text-blue-600',
    descripcion: 'Botones con gotas y reflejos de agua animados.',
    componente: <GlassWetButton>Reservar Ahora</GlassWetButton>,
  },
  {
    titulo: 'Modo Invierno',
    icono: Snowflake,
    color: 'text-blue-500',
    descripcion: 'Copos de nieve cayendo suavemente sobre la página.',
    componente: <SnowEffect />,
  },
  {
    titulo: 'Modo Playa',
    icono: Sun,
    color: 'text-orange-500',
    descripcion: 'Olas animadas en el fondo inferior, ideal para rutas costeras.',
    componente: <WaveEffect />,
  },
  {
    titulo: 'Ondas de Voz',
    icono: Mail,
    color: 'text-purple-600',
    descripcion: 'Interfaz de ondas de audio que reacciona al micrófono.',
    componente: <VozOndas />,
  },
  {
    titulo: 'Oferta Límite',
    icono: Clock,
    color: 'text-red-600',
    descripcion: 'Cronómetro regresivo con colores urgentes.',
    componente: <OfertaLimitada segundosRestantes={1200} />,
  },
  {
    titulo: 'Botón Imán',
    icono: MapPin,
    color: 'text-emerald-600',
    descripcion: 'Botón que se mueve ligeramente siguiendo el cursor.',
    componente: <ImánButton>Clic aquí</ImánButton>,
  },
  {
    titulo: 'Temporadas',
    icono: Leaf,
    color: 'text-green-600',
    descripcion: 'Cambia el tema visual según primavera, verano, otoño o invierno.',
    componente: <Estaciones activa="verano" />,
  },
  {
    titulo: 'Lámina Metálica',
    icono: PaletteIcon,
    color: 'text-amber-600',
    descripcion: 'Tarjeta con brillo que se mueve siguiendo el cursor.',
    componente: <MetalicaCard>Contenido premium con brillo dinámico</MetalicaCard>,
  },
  {
    titulo: 'Progreso Circular',
    icono: Clock,
    color: 'text-indigo-600',
    descripcion: 'Anillo de progreso para mostrar avance del viaje.',
    componente: <ProgresoCircular porcentaje={65} />,
  },
  {
    titulo: 'Modo Foco',
    icono: ShieldCheck,
    color: 'text-stone-600',
    descripcion: 'Oscurece la página excepto el elemento activo.',
    componente: <ModoFoco />,
  },
  {
    titulo: 'Máquina de Escribir',
    icono: Film,
    color: 'text-stone-600',
    descripcion: 'Títulos que aparecen letra por letra.',
    componente: <MaquinaEscribir texto="LUX Líneas Únicas Xpress" velocidad={60} />,
  },
  {
    titulo: 'Fondos Geométricos',
    icono: Layers,
    color: 'text-violet-600',
    descripcion: 'Patrones geométricos animados en el fondo.',
    componente: <FondosGeometricos />,
  },
  {
    titulo: 'Tarjetas con Capas',
    icono: Mail,
    color: 'text-stone-600',
    descripcion: 'Profundidad visual con sombras apiladas.',
    componente: <CapasCard titulo="Detalle del viaje" contenido="Este es el contenido de la tarjeta con profundidad por capas." />,
  },
  {
    titulo: 'Lectura Nocturna',
    icono: Globe,
    color: 'text-orange-600',
    descripcion: 'Fondo crema oscuro para leer boletos por la noche.',
    componente: <LecturaNocturna activo />,
  },
  {
    titulo: 'Transición Cortina',
    icono: Mail,
    color: 'text-rose-600',
    descripcion: 'Efecto de cortina al cambiar de vista.',
    componente: <CortinaTransition estaActiva>
      <p className="text-center text-stone-600 dark:text-stone-400">Contenido revelado por la cortina</p>
    </CortinaTransition>,
  },
  {
    titulo: 'Asientos Isométricos',
    icono: Monitor,
    color: 'text-stone-600',
    descripcion: 'Vista isométrica del mapa de asientos del bus.',
    componente: <AsientosIsometricos />,
  },
  {
    titulo: 'Panel de Configuración',
    icono: PaletteIcon,
    color: 'text-amber-600',
    descripcion: 'Panel deslizable con ajustes visuales rápidos.',
    componente: <PanelConfig abierto />,
  },
]

export default function Innovacion2() {
  return (
    <div className="min-h-screen bg-surface dark:bg-stone-950">
      <header className="border-b border-line dark:border-stone-700 bg-white/80 dark:bg-stone-900/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Bus size={24} className="text-primary" aria-hidden="true" />
              <span className="font-black text-2xl tracking-tight text-navy dark:text-white">LUX Innovaciones 2</span>
            </div>
            <Link to="/" className="btn-ghost">Volver al inicio</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-navy dark:text-white tracking-tight mb-2">
            Más Mejoras de Diseño Innovador
          </h1>
          <p className="text-stone-600 dark:text-stone-400">
            Segunda tanda de experiencias visuales interactivas en la rama <code className="bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 rounded text-xs">estilos</code>.
          </p>
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