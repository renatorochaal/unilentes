import { api } from './api'
import type { Catalog, ApiResponse } from '../types'

export const catalogService = {
  async list(params?: { brandId?: string; categoryId?: string }) {
    const { data } = await api.get<{ status: string; data: Catalog[] }>('/api/catalogs', { params })
    return data.data
  },

  async getById(id: string) {
    const { data } = await api.get<ApiResponse<Catalog>>(`/api/catalogs/${id}`)
    return data.data
  },
}
