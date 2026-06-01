import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  DATABASE_URL:          z.string().url(),
  JWT_SECRET:            z.string().min(16),
  JWT_EXPIRES_IN:        z.string().default('15m'),
  JWT_REFRESH_SECRET:    z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT:                  z.coerce.number().default(3000),
  NODE_ENV:              z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN:           z.string().default('http://localhost:5173'),
  EXPORTS_DIR:           z.string().default('./exports'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:')
  console.error(parsed.error.format())
  process.exit(1)
}

export const env = parsed.data
