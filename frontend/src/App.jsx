import { lazy, Suspense, useEffect, useState } from 'react'
import { Eye } from 'lucide-react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'sonner'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import ScrollToTop from './components/common/ScrollToTop'
import ProtectedRoute from './components/common/ProtectedRoute'
import CommandPalette from './components/common/CommandPalette.jsx'
import Onboarding from './components/common/Onboarding.jsx'
import AmbientStationSound from './components/common/AmbientStationSound.jsx'
import AccessibilityPanel from './components/common/AccessibilityPanel.jsx'

import About from './pages/About'
import Nosotros from './pages/Nosotros'
const Checkout = lazy(() => import('./pages/Checkout'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const SearchRoutes = lazy(() => import('./pages/SearchRoutes'))
const SeatSelection = lazy(() => import('./pages/SeatSelection'))
const MisPasajes = lazy(() => import('./pages/MisPasajes'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const NotFound = lazy(() => import('./pages/NotFound'))

const TITULOS = {
  '/': 'Inicio',
  '/buscar': 'Buscar Viajes',
  '/nosotros': 'Nosotros',
  '/checkout': 'Pago',
  '/mis-pasajes': 'Mis Pasajes',
  '/login': 'Iniciar Sesión',
  '/registro': 'Crear Cuenta',
  '/dashboard': 'Panel',
}

function TituloRuta() {
  const { pathname } = useLocation()
  useEffect(() => {
    const titulo = pathname.startsWith('/asientos') ? 'Elegir Asientos' : TITULOS[pathname]
    document.title = titulo ? `${titulo} | LUX` : 'LUX - Líneas Únicas Xpress - Venta de Pasajes'
  }, [pathname])
  return null
}

function Layout() {
  const { pathname } = useLocation()
  const esInicio = pathname === '/'
  const esNosotros = pathname === '/nosotros'
  const claseMain = esInicio
    ? 'flex-grow'
    : esNosotros
      ? 'flex-grow pt-20'
      : 'flex-grow pt-28 pb-8 w-full max-w-shell mx-auto px-4 sm:px-[30px]'

  return (
    <div className="min-h-screen bg-surface dark:bg-stone-950 flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>

      <Navbar />

      <main
        id="main"
        className={claseMain}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center gap-3 py-20 text-muted dark:text-stone-400">
                  <span className="spinner" aria-hidden="true" /> Cargando...
                </div>
              }
            >
              <Routes>
            <Route path="/" element={<About />} />
            <Route path="/buscar" element={<SearchRoutes />} />
            <Route path="/nosotros" element={<Nosotros />} />
            <Route path="/asientos/:routeId" element={<SeatSelection />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/mis-pasajes" element={<MisPasajes />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredRole="ADMIN">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  )
}

function App() {
  const [mostrarOnboarding, setMostrarOnboarding] = useState(() => {
    return localStorage.getItem('lux_onboarding') !== '1'
  })
  const [accesoAbierto, setAccesoAbierto] = useState(false)

  return (
    <Router>
      <ScrollToTop />
      <TituloRuta />
      <Layout />
      <CommandPalette />
      <Toaster richColors position="top-right" />
      <AmbientStationSound />
      {mostrarOnboarding && (
        <Onboarding onFinish={() => setMostrarOnboarding(false)} />
      )}
      <AccessibilityPanel open={accesoAbierto} onClose={() => setAccesoAbierto(false)} />
      <button
        type="button"
        onClick={() => setAccesoAbierto(o => !o)}
        aria-label={accesoAbierto ? 'Cerrar panel de accesibilidad' : 'Abrir panel de accesibilidad'}
        className="fixed bottom-4 left-4 z-[90] flex items-center justify-center w-10 h-10 rounded-full border border-line dark:border-stone-700 bg-white dark:bg-stone-800 shadow-soft hover:bg-primary hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Eye size={18} className="text-navy dark:text-white" />
        <span className="sr-only">Accesibilidad</span>
      </button>
    </Router>
  )
}

export default App
