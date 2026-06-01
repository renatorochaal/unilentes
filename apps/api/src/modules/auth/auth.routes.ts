import { Router } from 'express'
import { authController } from './auth.controller'
import { authGuard } from '../../shared/middleware/auth.guard'

export const authRouter = Router()

authRouter.post('/login',   authController.login)
authRouter.post('/refresh', authController.refresh)
authRouter.post('/logout',  authGuard, authController.logout)
authRouter.get('/me',       authGuard, authController.me)
