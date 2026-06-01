import { api } from './api'
import type { Treatment, ApiResponse } from '../types'

export const treatmentService = {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const { data } = await api.get<{ status: string; data: Treatment[] }>('/api/treatments', {
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
    const { data } = await api.get<ApiResponse<Treatment>>(`/api/treatments/${id}`)
    return data.data
  },

  async create(payload: Partial<Treatment>) {
    const { data } = await api.post<ApiResponse<Treatment>>('/api/treatments', payload)
    return data.data
  },

  async update(id: string, payload: Partial<Treatment>) {
    const { data } = await api.put<ApiResponse<Treatment>>(`/api/treatments/${id}`, payload)
    return data.data
  },

  async remove(id: string) {
    await api.delete(`/api/treatments/${id}`)
  },
}
