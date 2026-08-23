import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Rutas/Viajes
export const searchRoutes = (origen, destino) => api.get(`/routes/buscar?origen=${origen}&destino=${destino}`)
export const getRouteSeats = (routeId) => api.get(`/routes/${routeId}/asientos`)
export const getBuses = () => api.get('/buses/')
export const getBusSeats = (busId) => api.get(`/buses/${busId}/asientos`)

// Ventas
export const checkout = (data) => api.post('/sales/checkout', data)

// Auth
export const login = (data) => api.post('/auth/login', data)
export const register = (data) => api.post('/auth/register', data)

export default api
