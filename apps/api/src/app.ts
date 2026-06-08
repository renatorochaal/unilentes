import express from 'express'
import cors from 'cors'
import path from 'path'
import { env } from './config/env'
import { errorHandler } from './shared/middleware/error.handler'
import { authRouter } from './modules/auth/auth.routes'
import { productRouter } from './modules/products/product.routes'
import { brandRouter } from './modules/brands/brand.routes'
import { categoryRouter } from './modules/categories/category.routes'
import { supplierRouter } from './modules/suppliers/supplier.routes'
import { treatmentRouter } from './modules/treatments/treatment.routes'
import { catalogRouter } from './modules/catalogs/catalog.routes'
import { exportRouter } from './modules/exports/export.routes'
import { publicRouter } from './modules/public/public.routes'
import { uploadRouter } from './modules/uploads/upload.routes'

export const app = express()

// ── Middlewares globais ─────────────────────────────────────────────
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Servir arquivos estáticos ────────────────────────────────────────
app.use('/exports', express.static(path.resolve(env.EXPORTS_DIR)))
app.use('/uploads', express.static(path.resolve('./uploads')))

// ── Rotas ───────────────────────────────────────────────────────────
app.use('/api/auth',        authRouter)
app.use('/api/products',    productRouter)
app.use('/api/brands',      brandRouter)
app.use('/api/categories',  categoryRouter)
app.use('/api/suppliers',   supplierRouter)
app.use('/api/treatments',  treatmentRouter)
app.use('/api/catalogs',    catalogRouter)
app.use('/api/exports',     exportRouter)
app.use('/api/public',      publicRouter)
app.use('/api/uploads',     uploadRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Error handler (deve ser o último middleware) ─────────────────────
app.use(errorHandler)
