import axios from 'axios'
import { authStore } from '../stores/authStore'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  timeout: 30000,
})

apiClient.interceptors.request.use((config) => {
  const token = authStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data as { status?: boolean; message?: string }
    if (data.status === false) {
      throw new Error(data.message ?? 'Request failed')
    }
    return response
  },
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      authStore.getState().logout()
      if (!window.location.pathname.startsWith('/b/')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default apiClient
