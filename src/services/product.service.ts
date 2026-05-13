import { api } from './api'
import type { Product, PaginatedResponse, ApiResponse } from '../types'

export interface ProductFilters {
  search?: string
  brand?: string
  category?: string
  isActive?: boolean
  page?: number
  limit?: number
}

export interface ProductInput {
  code?: string
  name?: string
  brandId?: string
  categoryId?: string
  supplierId?: string | null
  spherical?: string | null
  cylindrical?: string | null
  diameter?: string | null
  addition?: string | null
  priceNoAR?: number | null
  height?: string | null
  availability?: string | null
  isActive?: boolean
  notes?: string | null
  imageUrl?: string | null
  treatments?: { treatmentId: string; price: number }[]
}

export const productService = {
  async list(params?: ProductFilters) {
    const { data } = await api.get<PaginatedResponse<Product>>('/api/products', { params })
    return data
  },

  async getById(id: string) {
    const { data } = await api.get<ApiResponse<Product>>(`/api/products/${id}`)
    return data.data
  },

  async create(payload: ProductInput) {
    const { data } = await api.post<ApiResponse<Product>>('/api/products', payload)
    return data.data
  },

  async update(id: string, payload: ProductInput) {
    const { data } = await api.put<ApiResponse<Product>>(`/api/products/${id}`, payload)
    return data.data
  },

  async remove(id: string) {
    await api.delete(`/api/products/${id}`)
  },
}
