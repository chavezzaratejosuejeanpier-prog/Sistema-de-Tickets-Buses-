import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import ScrollToTop from './components/common/ScrollToTop'
import ProtectedRoute from './components/common/ProtectedRoute'

const About = lazy(() => import('./pages/About'))
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
    document.title = titulo ? `${titulo} | BUSS ConnectPro` : 'BUSS ConnectPro - Venta de Pasajes'
  }, [pathname])
  return null
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <TituloRuta />

      <div className="min-h-screen bg-surface dark:bg-stone-950 flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Saltar al contenido
        </a>

        <Navbar />

        <main id="main" className="flex-grow py-8 w-full max-w-shell mx-auto px-4 sm:px-[30px]">
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
        </main>

        <Footer />
      </div>
    </Router>
  )
}

export default App
