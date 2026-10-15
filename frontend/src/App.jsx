import { lazy, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
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

function App() {
  return (
    <Router>
      <ScrollToTop />

      <div className="min-h-screen bg-surface flex flex-col">
        <Navbar />

        <main className="flex-grow py-8 w-full max-w-shell mx-auto px-4 sm:px-[30px]">
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
