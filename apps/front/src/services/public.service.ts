import axios from 'axios'
import type { Catalog, CatalogWithProducts, ApiResponse } from '../types'
import { API_BASE_URL } from './api'

// Instância sem interceptadores de auth — para rotas públicas
const publicApi = axios.create({
  baseURL: API_BASE_URL,
})

export const publicService = {
  async listCatalogs(): Promise<Catalog[]> {
    const { data } = await publicApi.get<{ status: string; data: Catalog[] }>('/api/public/catalogs')
    return data.data
  },

  async getCatalog(id: string, search?: string): Promise<CatalogWithProducts> {
    const { data } = await publicApi.get<ApiResponse<CatalogWithProducts>>(
      `/api/public/catalogs/${id}`,
      { params: search ? { search } : undefined }
    )
    return data.data
  },
}
