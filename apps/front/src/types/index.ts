// ── Auth ──────────────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'USER'
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  user: User
}

// ── Entidades de domínio ──────────────────────────────────────────────
export interface Brand {
  id: string
  name: string
  logoUrl?: string | null
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Supplier {
  id: string
  name: string
  cnpj?: string | null
  email?: string | null
  phone?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Treatment {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProductTreatment {
  id: string
  treatmentId: string
  price: number
  treatment: Pick<Treatment, 'id' | 'name'>
}

export interface Product {
  id: string
  code: string
  name: string
  brandId: string
  categoryId: string
  supplierId?: string | null
  spherical?: string | null
  cylindrical?: string | null
  diameter?: string | null
  addition?: string | null
  priceNoAR?: number | null
  height?: string | null
  availability?: string | null
  isActive: boolean
  notes?: string | null
  imageUrl?: string | null
  createdAt: string
  updatedAt: string
  brand: Pick<Brand, 'id' | 'name' | 'logoUrl'>
  category: Pick<Category, 'id' | 'name'>
  supplier?: Pick<Supplier, 'id' | 'name'> | null
  treatments: ProductTreatment[]
}

export interface Catalog {
  id: string
  title: string
  subtitle?: string | null
  badge?: string | null
  brandId: string
  categoryId: string
  headerImage?: string | null
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  brand: Pick<Brand, 'id' | 'name' | 'logoUrl'>
  category: Pick<Category, 'id' | 'name'>
}

export type ExportType = 'PDF' | 'CSV'
export type ExportStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface Export {
  id: string
  type: ExportType
  status: ExportStatus
  fileName?: string | null
  fileUrl?: string | null
  fileSize?: number | null
  filters?: Record<string, unknown> | null
  error?: string | null
  createdAt: string
  completedAt?: string | null
}

// ── Paginação ──────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  status: string
  data: T[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ApiResponse<T> {
  status: string
  data: T
}
