import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../../config/prisma'

export const publicRouter = Router()

// GET /api/public/catalogs — lista todos os catálogos ativos sem autenticação
publicRouter.get('/catalogs', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.catalog.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: {
        brand:    { select: { id: true, name: true, logoUrl: true } },
        category: { select: { id: true, name: true } },
      },
    })
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

// GET /api/public/catalogs/:id — detalhe com produtos (suporta ?search=)
publicRouter.get('/catalogs/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params
    const search = req.query.search as string | undefined

    const catalog = await prisma.catalog.findUnique({
      where: { id, isActive: true },
      include: {
        brand:    { select: { id: true, name: true, logoUrl: true } },
        category: { select: { id: true, name: true } },
      },
    })

    if (!catalog) {
      res.status(404).json({ status: 'error', message: 'Catálogo não encontrado.' })
      return
    }

    const products = await prisma.product.findMany({
      where: {
        brandId:    catalog.brandId,
        categoryId: catalog.categoryId,
        isActive:   true,
        ...(search ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { code: 'asc' },
      include: {
        treatments: {
          include: { treatment: { select: { id: true, name: true } } },
          orderBy:  { treatment: { name: 'asc' } },
        },
      },
    })

    res.json({ status: 'success', data: { ...catalog, products } })
  } catch (e) { next(e) }
})
