import { api } from './api'
import type { Category, ApiResponse } from '../types'

export const categoryService = {
  async list(params?: { search?: string; page?: number; limit?: number }) {
    const { data } = await api.get<{ status: string; data: Category[] }>('/api/categories', {
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
    const { data } = await api.get<ApiResponse<Category>>(`/api/categories/${id}`)
    return data.data
  },

  async create(payload: Partial<Category>) {
    const { data } = await api.post<ApiResponse<Category>>('/api/categories', payload)
    return data.data
  },

  async update(id: string, payload: Partial<Category>) {
    const { data } = await api.put<ApiResponse<Category>>(`/api/categories/${id}`, payload)
    return data.data
  },

  async remove(id: string) {
    await api.delete(`/api/categories/${id}`)
  },
}
