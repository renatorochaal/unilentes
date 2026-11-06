import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    })
    return
  }

  // Erros do Prisma
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    // No MySQL, target vem como o nome do índice (string), não como lista de campos
    const prismaErr = err as unknown as { code: string; meta?: { target?: string | string[] } }
    if (prismaErr.code === 'P2002') {
      const target = [prismaErr.meta?.target ?? 'valor'].flat().join(', ')
      console.error('Registro duplicado:', target)
      res.status(409).json({
        status: 'error',
        message: `Já existe um registro com este ${target}.`,
      })
      return
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({ status: 'error', message: 'Registro não encontrado.' })
      return
    }
  }

  console.error('❌ Erro não tratado:', err)
  res.status(500).json({
    status: 'error',
    message: 'Erro interno do servidor.',
  })
}
