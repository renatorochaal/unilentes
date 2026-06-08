import axios from 'axios'
import type { Catalog, CatalogWithProducts, ApiResponse } from '../types'

// Instância sem interceptadores de auth — para rotas públicas
const publicApi = axios.create({
  baseURL: (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? 'http://localhost:3030',
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
