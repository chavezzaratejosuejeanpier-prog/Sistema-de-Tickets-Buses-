import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Home, Bus, User, LayoutDashboard, X } from 'lucide-react'
import { useAuth } from '../../context/useAuth.js'

const PAGINAS = [
  { label: 'Inicio', to: '/', icon: Home },
  { label: 'Buscar viajes', to: '/buscar', icon: Bus },
  { label: 'Nosotros', to: '/nosotros', icon: User },
  { label: 'Mis Pasajes', to: '/mis-pasajes', icon: Bus },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const navigate = useNavigate()
  const { user } = useAuth()

  const items = useMemo(() => {
    const base = [...PAGINAS]
    if (user?.rol === 'ADMIN') base.push({ label: 'Panel admin', to: '/dashboard', icon: LayoutDashboard })
    if (!user) base.push({ label: 'Iniciar sesión', to: '/login', icon: User })
    const qq = q.trim().toLowerCase()
    if (!qq) return base
    return base.filter(i => i.label.toLowerCase().includes(qq) || i.to.includes(qq))
  }, [q, user])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { setIdx(0) }, [q, open])

  if (!open) return null

  const elegir = (to) => {
    navigate(to)
    setOpen(false)
    setQ('')
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && items[idx]) { e.preventDefault(); elegir(items[idx].to) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg rounded-2xl border border-line dark:border-stone-700 bg-white dark:bg-stone-900 shadow-lift overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line dark:border-stone-700">
          <Search size={18} className="text-muted" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar páginas, acciones..."
            className="flex-1 bg-transparent outline-none text-sm text-navy dark:text-white placeholder-stone-400"
          />
          <button onClick={() => setOpen(false)} className="text-muted hover:text-navy dark:hover:text-white">
            <X size={18} />
          </button>
        </div>
        <ul className="max-h-72 overflow-y-auto py-2">
          {items.length === 0 && <li className="px-4 py-3 text-sm text-muted">Sin resultados</li>}
          {items.map((it, i) => {
            const Icon = it.icon
            return (
              <li key={it.to}>
                <button
                  onClick={() => elegir(it.to)}
                  onMouseEnter={() => setIdx(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${i === idx ? 'bg-primary/10 text-primary' : 'text-navy dark:text-stone-200 hover:bg-slate-50 dark:hover:bg-stone-800'}`}
                >
                  <Icon size={16} />
                  {it.label}
                  <span className="ml-auto text-xs text-muted">{it.to}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="px-4 py-2 border-t border-line dark:border-stone-700 text-[11px] text-muted flex gap-3">
          <span>↑↓ navegar</span>
          <span>Enter abrir</span>
          <span>Esc cerrar</span>
          <span className="ml-auto">Ctrl+K</span>
        </div>
      </div>
    </div>
  )
}