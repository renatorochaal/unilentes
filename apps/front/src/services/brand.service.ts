import { api } from './api'
import type { Brand, ApiResponse } from '../types'

export const brandService = {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const { data } = await api.get<{ status: string; data: Brand[] }>('/api/brands', {
      params: params?.search ? { search: params.search } : undefined,
    })
    const all   = data.data ?? []
    const limit = params?.limit ?? 20
    const page  = params?.page  ?? 1
    const start = (page - 1) * limit
    const slice = all.slice(start, start + limit)
    return {
      data: slice,
      meta: { page, limit, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / limit)) },
    }
  },

  async getById(id: string) {
    const { data } = await api.get<ApiResponse<Brand>>(`/api/brands/${id}`)
    return data.data
  },

  async create(payload: Partial<Brand>) {
    const { data } = await api.post<ApiResponse<Brand>>('/api/brands', payload)
    return data.data
  },

  async update(id: string, payload: Partial<Brand>) {
    const { data } = await api.put<ApiResponse<Brand>>(`/api/brands/${id}`, payload)
    return data.data
  },

  async remove(id: string) {
    await api.delete(`/api/brands/${id}`)
  },
}
