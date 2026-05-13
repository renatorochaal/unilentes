import { api } from './api'
import type { AuthTokens } from '../types'

export const authService = {
  async login(email: string, password: string): Promise<AuthTokens> {
    const { data } = await api.post('/api/auth/login', { email, password })
    return data.data
  },

  async refresh(refreshToken: string) {
    const { data } = await api.post('/api/auth/refresh', { refreshToken })
    return data.data as { accessToken: string; refreshToken: string }
  },

  async logout() {
    await api.post('/api/auth/logout').catch(() => {})
  },

  async me() {
    const { data } = await api.get('/api/auth/me')
    return data.data
  },
}
