import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { checkout, getRoutes } from '../services/api.js';

function leerReservaFallback() {
  try {
    const raw = localStorage.getItem('reserva');
    if (!raw) return null;
    const r = JSON.parse(raw);
    const nums = Array.isArray(r.asientos) ? r.asientos.filter((n) => Number.isInteger(n)) : [];
    if (!r.routeId || nums.length === 0) return null;
    return { routeId: Number(r.routeId), asientos: nums.map((n) => ({ id: n, number: n })), precio: r.precio != null ? Number(r.precio) : null };
  } catch {
    return null;
  }
}

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const inicial = useMemo(() => {
    const st = location.state;
    if (st?.routeId && Array.isArray(st?.asientos) && st.asientos.length > 0) {
      const asientos = st.asientos
        .map((a) => (typeof a === 'number' ? { id: a, number: a } : a))
        .filter((a) => Number.isInteger(a?.number));
      if (asientos.length > 0) return { routeId: Number(st.routeId), asientos, precio: st.precio != null ? Number(st.precio) : null };
    }
    return leerReservaFallback();
  }, [location.state]);

  const [pasajeros, setPasajeros] = useState(
    (inicial?.asientos || []).map((a) => ({ asiento_id: a.id, numero: a.number, dni: '', nombres: '' })),
  );
  const [email, setEmail] = useState('');
  const [precio, setPrecio] = useState(inicial?.precio ?? null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [enviando, setEnviando] = useState(false);
  const [result, setResult] = useState(null);

  // Precio real desde backend si no vino en el state (para no mostrar S/ 45 quemado)
  useEffect(() => {
    if (precio != null || !inicial?.routeId) return;
    let vivo = true;
    getRoutes()
      .then(({ data }) => {
        if (!vivo) return;
        const ruta = data.find((r) => String(r.id) === String(inicial.routeId));
        if (ruta) setPrecio(Number(ruta.precio_base));
      })
      .catch(() => {})
    return () => { vivo = false };
  }, [inicial?.routeId, precio]);

  useEffect(() => {
    if (!inicial) return;
    if (timeLeft <= 0) {
      Swal.fire({
        title: 'Tiempo agotado',
        text: 'Tu reserva ha expirado. Vuelve a seleccionar tus asientos.',
        icon: 'warning',
        confirmButtonColor: '#1e3a8a',
      }).then(() => navigate('/buscar'));
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, navigate, inicial]);

  if (!inicial || pasajeros.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-10">
        <div className="empty-state">
          <p className="font-bold text-navy">No hay asientos seleccionados</p>
          <p className="mt-1">El pago directo sin reserva está deshabilitado para evitar cobros sin asiento.</p>
          <Link to="/buscar" className="btn-primary mt-4">Buscar viajes</Link>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="max-w-xl mx-auto p-6 mt-10">
        <div className="card p-8 text-center">
          <h2 className="text-2xl font-bold text-green-600">¡Compra Exitosa!</h2>
          <p className="mt-2">Código: <span className="font-mono font-bold">{result.codigo_reserva}</span></p>
          <p className="mt-1 text-sm text-stone-600">Ruta #{inicial.routeId} • Asientos: {result.asientos.join(', ')} • Total: S/ {Number(result.total).toFixed(2)}</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link to="/buscar" className="btn-outline">Volver a buscar</Link>
            <button type="button" className="btn-primary" onClick={() => { try { localStorage.removeItem('reserva'); } catch {} navigate('/buscar'); }}>Aceptar</button>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (index, field, value) => {
    const nuevosPasajeros = [...pasajeros];
    nuevosPasajeros[index][field] = value;
    setPasajeros(nuevosPasajeros);
  };

  const procesarPago = async (e) => {
    e.preventDefault();
    if (enviando) return;

    for (const p of pasajeros) {
      if (!p.dni || !p.nombres) {
        Swal.fire('Error', 'Todos los campos son obligatorios.', 'error');
        return;
      }
      if (p.dni.length !== 8 || Number.isNaN(Number(p.dni))) {
        Swal.fire('DNI Inválido', `El DNI del asiento ${p.numero} debe tener 8 números.`, 'error');
        return;
      }
      if (p.nombres.trim().length < 3) {
        Swal.fire('Nombre Inválido', `Ingresa un nombre válido para el asiento ${p.numero}.`, 'error');
        return;
      }
    }
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      Swal.fire('Email Inválido', 'Ingresa un correo válido para enviar tus boletos.', 'error');
      return;
    }

    setEnviando(true);
    try {
      // El backend registra un comprador por checkout: se usa el primer pasajero como titular
      const { data } = await checkout({
        route_id: Number(inicial.routeId),
        asientos: pasajeros.map((p) => Number(p.numero)),
        pasajero_nombre: pasajeros[0].nombres.trim(),
        pasajero_dni: pasajeros[0].dni.trim(),
        email: email.trim(),
      });
      try { localStorage.removeItem('reserva'); } catch {}
      setResult(data);
      Swal.fire({
        title: '¡Pago Exitoso!',
        text: `Código de reserva: ${data.codigo_reserva}`,
        icon: 'success',
        confirmButtonColor: '#10b981',
      });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || 'No se pudo procesar el pago. Verifica que el backend esté activo.';
      Swal.fire(status === 409 ? 'Asiento ya vendido' : 'Error en el pago', detail, 'error');
    } finally {
      setEnviando(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const totalEstimado = precio != null ? (pasajeros.length * Number(precio)).toFixed(2) : null;

  return (
    <div className="min-h-screen bg-canvas py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-navy text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Completa tu compra</h2>
            <p className="text-sm text-white/70 mt-1">Ruta #{inicial.routeId} • {pasajeros.length} asiento(s): {pasajeros.map((p) => p.numero).join(', ')}</p>
          </div>
          <div className="flex items-center gap-2 bg-navy-light px-4 py-2 rounded-lg font-mono text-xl" aria-live="off">
            <span aria-hidden="true">⏱️</span> <span aria-label="Tiempo restante">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <form onSubmit={procesarPago} className="p-8">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-stone-700 mb-1">Email de contacto</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="Ej. juan@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-6 mt-6">
            {pasajeros.map((pasajero, index) => (
              <div key={pasajero.numero} className="card p-6 rounded-xl relative">
                <span className="badge bg-navy text-white absolute -top-3 left-4 shadow-sm">
                  Asiento {pasajero.numero}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label htmlFor={`dni-${index}`} className="block text-sm font-semibold text-stone-700 mb-1">DNI</label>
                    <input
                      id={`dni-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength="8"
                      className="input"
                      placeholder="Ej. 76543210"
                      value={pasajero.dni}
                      onChange={(e) => handleInputChange(index, 'dni', e.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                  <div>
                    <label htmlFor={`nombres-${index}`} className="block text-sm font-semibold text-stone-700 mb-1">Nombres Completos</label>
                    <input
                      id={`nombres-${index}`}
                      type="text"
                      className="input"
                      placeholder="Ej. Juan Pérez"
                      value={pasajero.nombres}
                      onChange={(e) => handleInputChange(index, 'nombres', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-black/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-stone-700 text-lg">
              Total a pagar:{' '}
              <span className="text-2xl font-black text-navy">
                {totalEstimado != null ? `S/ ${totalEstimado}` : 'Según tarifa de ruta'}
              </span>
            </div>
            <button type="submit" className="btn-accent w-full md:w-auto" disabled={enviando}>
              {enviando ? (<><span className="spinner" aria-hidden="true" /> Procesando...</>) : 'Confirmar y Pagar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
