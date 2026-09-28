import axios from 'axios'

// Compatible: si existe VITE_API_URL se usa, si no se mantiene el backend local.
// No cambia el comportamiento actual cuando no hay `.env`.
const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

export const searchRoutes = (origen, destino, fecha) => {
  const params = new URLSearchParams({ origen, destino })
  if (fecha) params.append('fecha', fecha)
  return api.get(`/routes/buscar?${params.toString()}`)
}

export const getRouteSeats = (routeId) => api.get(`/routes/${routeId}/asientos`)
export const getRoutes = () => api.get('/routes/')
export const getBuses = () => api.get('/buses/')
export const getBusSeats = (busId) => api.get(`/buses/${busId}/asientos`)

export const checkout = (data) => api.post('/sales/checkout', data)
export const getSalesSummary = () => api.get('/sales/')
export const getTicketByCode = (codigo) => api.get(`/sales/tickets/${codigo}`)

export const login = (data) => api.post('/auth/login', data)
export const register = (data) => api.post('/auth/register', data)

export default api