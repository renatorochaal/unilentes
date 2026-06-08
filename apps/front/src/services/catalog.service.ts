import { api } from './api'
import type { Catalog, CatalogWithProducts, ApiResponse, ColumnVisibility, CatalogSection } from '../types'

export interface CatalogPayload {
  title:          string
  subtitle?:      string | null
  badge?:         string | null
  brandId:        string
  categoryId:     string
  headerImage?:   string | null
  description?:   string | null
  isActive?:      boolean
  sortOrder?:     number
  crmUrl?:        string | null
  visibleColumns?: ColumnVisibility | null
  sections?:      CatalogSection[] | null
}

export const catalogService = {
  async list(params?: { all?: boolean }): Promise<Catalog[]> {
    const { data } = await api.get<{ status: string; data: Catalog[] }>('/api/catalogs', {
      params: params?.all ? { all: 'true' } : undefined,
    })
    return data.data
  },

  async getById(id: string): Promise<CatalogWithProducts> {
    const { data } = await api.get<ApiResponse<CatalogWithProducts>>(`/api/catalogs/${id}`)
    return data.data
  },

  async create(payload: CatalogPayload): Promise<Catalog> {
    const { data } = await api.post<ApiResponse<Catalog>>('/api/catalogs', payload)
    return data.data
  },

  async update(id: string, payload: Partial<CatalogPayload>): Promise<Catalog> {
    const { data } = await api.put<ApiResponse<Catalog>>(`/api/catalogs/${id}`, payload)
    return data.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/api/catalogs/${id}`)
  },
}
