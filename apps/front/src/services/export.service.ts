import { api } from './api'
import type { Export, ApiResponse } from '../types'

export const exportService = {
  async list() {
    const { data } = await api.get<{ status: string; data: Export[] }>('/api/exports')
    return data.data ?? []
  },

  async create(payload: Record<string, unknown>) {
    const { data } = await api.post<ApiResponse<Export>>('/api/exports', payload)
    return data.data
  },

  /**
   * Faz o download autenticado via fetch com o token JWT no header.
   * window.open() não envia headers customizados — por isso não funciona.
   */
  async download(id: string, fileName: string, type: 'PDF' | 'CSV') {
    const token = localStorage.getItem('accessToken')
    const baseUrl = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? 'http://localhost:3030'

    const response = await fetch(`${baseUrl}/api/exports/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error((body as { message?: string }).message ?? 'Erro ao baixar arquivo.')
    }

    const blob = await response.blob()
    const mimeType = type === 'CSV' ? 'text/csv' : 'application/pdf'
    const objectUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }))

    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  },

  async remove(id: string) {
    await api.delete(`/api/exports/${id}`)
  },
}
