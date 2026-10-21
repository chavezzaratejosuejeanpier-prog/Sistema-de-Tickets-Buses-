import axios from 'axios'

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

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const searchRoutes = (origen, destino, fecha) => {
  const params = new URLSearchParams({ origen, destino })
  if (fecha) params.append('fecha', fecha)
  return api.get(`/routes/buscar?${params.toString()}`)
}

export const getRouteSeats = (routeId) => api.get(`/routes/${routeId}/asientos`)
export const getRoutes = () => api.get('/routes/')
export const getBuses = () => api.get('/buses/')

export const checkout = (data) => api.post('/sales/checkout', data)
export const getSalesSummary = () => api.get('/sales/')
export const getTicketByCode = (codigo) => api.get(`/sales/tickets/${codigo}`)

export const login = (data) => api.post('/auth/login', data)
export const register = (data) => api.post('/auth/register', data)

export default api