import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

const IMAGENES = import.meta.glob('../assets/routes/*.{jpg,jpeg,webp,png}', { eager: true, import: 'default' })

export default function RouteCard({ ruta }) {
  const src = IMAGENES[`../assets/routes/${ruta.imagen}`]
  const [tilt, setTilt] = useState({ x: 0, y: 0, on: false })
  const hue = (str) => {
    let h = 0
    for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
    return h % 360
  }
  const routeHue = hue(ruta.destino || ruta.origen)

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ x: py * -8, y: px * 8, on: true })
  }
  const onLeave = () => setTilt({ x: 0, y: 0, on: false })

  return (
    <Link
      to="/buscar"
      state={{ origen: ruta.origen, destino: ruta.destino, fecha: '' }}
      aria-label={`Buscar pasajes de ${ruta.origen} a ${ruta.destino}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{
        transform: tilt.on
          ? `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(4px)`
          : 'perspective(900px) rotateX(0) rotateY(0)',
        transition: tilt.on ? 'transform 120ms ease-out' : 'transform 400ms ease-out',
      }}
      className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-navy shadow-[0_18px_40px_-20px_rgba(2,6,23,0.55)] ring-1 ring-black/5 transition-shadow duration-300 hover:shadow-[0_28px_60px_-20px_rgba(234,88,12,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-navy motion-reduce:transform-none motion-reduce:transition-none dark:ring-white/10 dark:focus-visible:ring-offset-stone-950"
    >
      {src ? (
        <img
          src={src}
          alt={ruta.alt}
          loading="lazy"
          decoding="async"
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105 motion-reduce:group-hover:scale-100"
        />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-navy to-stone-900" />
      )}

      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy/95 via-navy/45 to-navy/5" />

      {ruta.badge && (
        <span className="absolute left-3 top-3 rounded-full border border-white/30 bg-white/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-navy backdrop-blur">
          {ruta.badge}
        </span>
      )}

      <span className="absolute inset-x-3 bottom-3 rounded-xl border border-white/20 bg-white/15 p-3 shadow-lg backdrop-blur-md transition-colors group-hover:bg-white/20">
        <span className="flex items-center justify-between gap-2">
          <span className="text-base font-extrabold leading-tight text-white sm:text-lg">
            {ruta.origen} <span style={{ color: `hsl(${routeHue}, 75%, 65%)` }}>→</span> {ruta.destino}
          </span>
          <ArrowUpRight size={18} className="shrink-0 text-white/80" aria-hidden="true" />
        </span>
        <span className="mt-1 block text-[11px] text-white/85 sm:text-xs">
          Desde <span className="font-bold" style={{ color: `hsl(${routeHue}, 75%, 65%)` }}>S/ {ruta.precioDesde}</span> · {ruta.duracion}
        </span>
      </span>
    </Link>
  )
}