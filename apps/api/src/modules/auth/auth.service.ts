import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../config/prisma'
import { env } from '../../config/env'
import { AppError } from '../../shared/middleware/error.handler'

function generateAccessToken(payload: { sub: string; email: string; role: string }) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions)
}

function generateRefreshToken(payload: { sub: string }) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions)
}

export const authService = {
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.isActive) {
      throw new AppError('Credenciais inválidas.', 401)
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      throw new AppError('Credenciais inválidas.', 401)
    }

    const payload = { sub: user.id, email: user.email, role: user.role }
    const accessToken  = generateAccessToken(payload)
    const refreshToken = generateRefreshToken({ sub: user.id })

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    })

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }
  },

  async refresh(refreshToken: string) {
    let payload: { sub: string }
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { sub: string }
    } catch {
      throw new AppError('Refresh token inválido ou expirado.', 401)
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user || user.refreshToken !== refreshToken || !user.isActive) {
      throw new AppError('Refresh token inválido.', 401)
    }

    const newAccessToken  = generateAccessToken({ sub: user.id, email: user.email, role: user.role })
    const newRefreshToken = generateRefreshToken({ sub: user.id })

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    })

    return { accessToken: newAccessToken, refreshToken: newRefreshToken }
  },

  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    })
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    if (!user) throw new AppError('Usuário não encontrado.', 404)
    return user
  },
}
