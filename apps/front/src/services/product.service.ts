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

export interface ImportSheetSummary {
  name: string
  products: number
  treatments: string[]
  duplicates: number
  conflicts: number
  ignoredColumns: { name: string; prices: number }[]
  suggestedBrand: string
  suggestedCategory: string
}

export interface SheetMapping {
  sheet: string
  brand: string
  category: string
}

export interface ProductImportResult {
  dryRun: boolean
  needsMapping: boolean
  sheets: ImportSheetSummary[]
  total: number
  created: number
  updated: number
  treatmentColumns: string[]
  newBrands: string[]
  newCategories: string[]
  newTreatments: string[]
  configuredCategories: string[]
  warnings: string[]
  errors: { line: number; sheet?: string; code?: string; message: string }[]
}

export interface ProductImportOptions {
  dryRun: boolean
  createMissing: boolean
  mapping?: SheetMapping[]
}

export const productService = {
  /** dryRun=true só valida e devolve o resumo; nada é gravado. */
  async importFile(file: File, { dryRun, createMissing, mapping }: ProductImportOptions) {
    const form = new FormData()
    form.append('file', file)
    if (mapping) form.append('mapping', JSON.stringify(mapping))
    const { data } = await api.post<ApiResponse<ProductImportResult>>('/api/products/import', form, {
      params: { dryRun, createMissing },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data
  },

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

  async removeMany(ids: string[]) {
    const { data } = await api.post<ApiResponse<{ count: number }>>('/api/products/bulk-delete', { ids })
    return data.data
  },

  async setActiveMany(ids: string[], isActive: boolean) {
    const { data } = await api.post<ApiResponse<{ count: number }>>('/api/products/bulk-status', { ids, isActive })
    return data.data
  },
}
