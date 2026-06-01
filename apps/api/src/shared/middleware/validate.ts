import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'
import { AppError } from './error.handler'

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const messages = result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ')
      return next(new AppError(`Dados inválidos: ${messages}`, 400))
    }
    req.body = result.data
    next()
  }
}

export function paginate(req: Request) {
  const page  = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
  const skip  = (page - 1) * limit
  return { page, limit, skip }
}
