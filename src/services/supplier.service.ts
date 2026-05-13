import { api } from './api'
import type { Supplier, ApiResponse } from '../types'

export const supplierService = {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const { data } = await api.get<{ status: string; data: Supplier[] }>('/api/suppliers', {
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
    const { data } = await api.get<ApiResponse<Supplier>>(`/api/suppliers/${id}`)
    return data.data
  },

  async create(payload: Partial<Supplier>) {
    const { data } = await api.post<ApiResponse<Supplier>>('/api/suppliers', payload)
    return data.data
  },

  async update(id: string, payload: Partial<Supplier>) {
    const { data } = await api.put<ApiResponse<Supplier>>(`/api/suppliers/${id}`, payload)
    return data.data
  },

  async remove(id: string) {
    await api.delete(`/api/suppliers/${id}`)
  },
}
