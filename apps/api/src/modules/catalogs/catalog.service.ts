import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { z } from 'zod'

export const catalogSchema = z.object({
  title:       z.string().min(1),
  subtitle:    z.string().optional().nullable(),
  badge:       z.string().optional().nullable(),
  brandId:     z.string().uuid(),
  categoryId:  z.string().uuid(),
  headerImage: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive:    z.boolean().optional(),
  sortOrder:   z.number().int().optional(),
})

export const catalogService = {
  async list() {
    return prisma.catalog.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: {
        brand:    { select: { id: true, name: true, logoUrl: true } },
        category: { select: { id: true, name: true } },
      },
    })
  },

  async getById(id: string) {
    const catalog = await prisma.catalog.findUnique({
      where: { id },
      include: {
        brand:    { select: { id: true, name: true, logoUrl: true } },
        category: { select: { id: true, name: true } },
      },
    })
    if (!catalog) throw new AppError('Catálogo não encontrado.', 404)

    // Buscar produtos da mesma marca e categoria
    const products = await prisma.product.findMany({
      where: {
        brandId:    catalog.brandId,
        categoryId: catalog.categoryId,
        isActive:   true,
      },
      orderBy: { code: 'asc' },
      include: {
        treatments: {
          include: { treatment: { select: { id: true, name: true } } },
          orderBy:  { treatment: { name: 'asc' } },
        },
      },
    })

    return { ...catalog, products }
  },

  async create(data: z.infer<typeof catalogSchema>) {
    return prisma.catalog.create({
      data,
      include: {
        brand:    { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    })
  },

  async update(id: string, data: Partial<z.infer<typeof catalogSchema>>) {
    await this.getById(id)
    return prisma.catalog.update({
      where: { id },
      data,
      include: {
        brand:    { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    })
  },

  async remove(id: string) {
    await this.getById(id)
    return prisma.catalog.delete({ where: { id } })
  },
}
