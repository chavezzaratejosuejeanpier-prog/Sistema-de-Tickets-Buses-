import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/layout/Navbar.jsx'
import Footer from './components/layout/Footer.jsx'
import SearchRoutes from './pages/SearchRoutes.jsx'
import SeatSelection from './pages/SeatSelection.jsx'
import Checkout from './pages/Checkout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<SearchRoutes />} />
            <Route path="/buscar" element={<SearchRoutes />} />
            <Route path="/asientos/:routeId" element={<SeatSelection />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  )
}
