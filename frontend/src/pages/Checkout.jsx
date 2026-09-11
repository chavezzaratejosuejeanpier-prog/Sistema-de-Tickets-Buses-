import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const asientosSeleccionados = location.state?.asientos || [{ id: 1, number: 14 }];
  const precioPorAsiento = 45.0;

  const [pasajeros, setPasajeros] = useState(
    asientosSeleccionados.map(a => ({ asiento_id: a.id, numero: a.number, dni: '', nombres: '' }))
  );
  const [timeLeft, setTimeLeft] = useState(300);

  useEffect(() => {
    if (timeLeft <= 0) {
      Swal.fire({
        title: 'Tiempo agotado',
        text: 'Tu reserva ha expirado. Vuelve a seleccionar tus asientos.',
        icon: 'warning',
        confirmButtonColor: '#0f2a44'
      }).then(() => navigate('/'));
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, navigate]);

  const handleInputChange = (index, field, value) => {
    const nuevosPasajeros = [...pasajeros];
    nuevosPasajeros[index][field] = value;
    setPasajeros(nuevosPasajeros);
  };

  const procesarPago = (e) => {
    e.preventDefault();
    
    for (let p of pasajeros) {
      if (!p.dni || !p.nombres) {
        Swal.fire('Error', 'Todos los campos son obligatorios.', 'error');
        return;
      }
      if (p.dni.length !== 8 || isNaN(p.dni)) {
        Swal.fire('DNI Inválido', `El DNI del asiento ${p.numero} debe tener 8 números.`, 'error');
        return;
      }
      if (p.nombres.trim().length < 3) {
        Swal.fire('Nombre Inválido', `Ingresa un nombre válido para el asiento ${p.numero}.`, 'error');
        return;
      }
    }

    Swal.fire({
      title: '¡Pago Exitoso!',
      text: 'Tus pasajes han sido generados correctamente.',
      icon: 'success',
      confirmButtonColor: '#10b981'
    }).then(() => navigate('/'));
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-primary text-white p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">Completa tu compra</h2>
          <div className="flex items-center gap-2 bg-primary-light px-4 py-2 rounded-lg font-mono text-xl">
            <span>⏱️</span> {formatTime(timeLeft)}
          </div>
        </div>

        <form onSubmit={procesarPago} className="p-8">
          <div className="space-y-6">
            {pasajeros.map((pasajero, index) => (
              <div key={index} className="p-6 bg-slate-50 border border-slate-200 rounded-xl relative">
                <span className="badge bg-orange-500 text-white absolute -top-3 left-4 shadow-sm">
                  Asiento {pasajero.numero}
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">DNI</label>
                    <input
                      type="text"
                      maxLength="8"
                      className="input"
                      placeholder="Ej. 76543210"
                      value={pasajero.dni}
                      onChange={(e) => handleInputChange(index, 'dni', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Nombres Completos</label>
                    <input
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

          <div className="mt-8 border-t border-slate-200 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-slate-700 text-lg">
              Total a pagar: <span className="text-2xl font-black text-primary">S/ {(pasajeros.length * precioPorAsiento).toFixed(2)}</span>
            </div>
            <button
              type="submit"
              className="btn-accent w-full md:w-auto"
            >
              Confirmar y Pagar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;
