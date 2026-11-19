import axios from 'axios'
import { urlLogin } from '../utils/destino.js'

const BASE_URL = import.meta.env?.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
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
        // Conserva la ruta actual (p. ej. /checkout) para volver tras el login;
        // la selección de asientos sigue en localStorage. Nunca lleva tokens.
        window.location.href = urlLogin(window.location.pathname)
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
export const getCiudades = () => api.get('/routes/ciudades')
export const getRoutePairs = () => api.get('/routes/pares')
export const getBuses = () => api.get('/buses/')

export const checkout = (data) => api.post('/sales/checkout', data)
export const getSalesSummary = () => api.get('/sales/')
export const getTicketByCode = (codigo) => api.get(`/sales/tickets/${encodeURIComponent(codigo)}`)

// El PDF exige la sesión: se descarga con el header Authorization del
// interceptor (nunca con el token en la URL) y se entrega como Blob.
export const getTicketPdf = (codigo) =>
  api.get(`/sales/tickets/${encodeURIComponent(codigo)}/pdf`, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
  })

export async function descargarBoletoPdf(codigo) {
  let respuesta
  try {
    respuesta = await getTicketPdf(codigo)
  } catch (err) {
    // Con responseType blob el detalle del error también llega como Blob.
    const cuerpo = err.response?.data
    if (cuerpo instanceof window.Blob) {
      try {
        err.detalle = JSON.parse(await cuerpo.text())?.detail
      } catch {
        // cuerpo no JSON: se usa el mensaje genérico
      }
    }
    throw err
  }
  const url = window.URL.createObjectURL(respuesta.data)
  try {
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `boleto-${codigo}.pdf`
    document.body.appendChild(enlace)
    enlace.click()
    enlace.remove()
  } finally {
    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  }
}

export const login = (data) => api.post('/auth/login', data)
export const register = (data) => api.post('/auth/register', data)

export default api