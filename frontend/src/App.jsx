import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import About from './pages/About';
import Checkout from './pages/Checkout';
import Login from './pages/Login';
import Register from './pages/Register';
import SearchRoutes from './pages/SearchRoutes';
import SeatSelection from './pages/SeatSelection';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';

// Al navegar (incluso a la misma ruta) vuelve arriba: sin esto la página conserva el scroll anterior
function ScrollToTop() {
  const { pathname, key } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, key]);
  return null;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="min-h-screen bg-surface flex flex-col">
        <Navbar />

        <main className="flex-grow py-8 w-full max-w-shell mx-auto px-4 sm:px-[30px]">
          <Routes>
            <Route path="/" element={<About />} />
            <Route path="/buscar" element={<SearchRoutes />} />
            <Route path="/asientos/:routeId" element={<SeatSelection />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}

export default App;
