import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authService } from './auth.service'
import { AppError } from '../../shared/middleware/error.handler'

const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(1, 'Senha obrigatória.'),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token obrigatório.'),
})

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = loginSchema.parse(req.body)
      const result = await authService.login(email, password)
      res.json({ status: 'success', data: result })
    } catch (err) {
      next(err)
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = refreshSchema.parse(req.body)
      const result = await authService.refresh(refreshToken)
      res.json({ status: 'success', data: result })
    } catch (err) {
      next(err)
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Não autenticado.', 401)
      await authService.logout(req.user.sub)
      res.json({ status: 'success', message: 'Sessão encerrada.' })
    } catch (err) {
      next(err)
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new AppError('Não autenticado.', 401)
      const user = await authService.me(req.user.sub)
      res.json({ status: 'success', data: user })
    } catch (err) {
      next(err)
    }
  },
}
