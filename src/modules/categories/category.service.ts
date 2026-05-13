import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { z } from 'zod'

export const categorySchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório.'),
  description: z.string().optional().nullable(),
  isActive:    z.boolean().optional(),
})

export type CategoryInput = z.infer<typeof categorySchema>

export const categoryService = {
  async list(search?: string) {
    return prisma.category.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
  },

  async getById(id: string) {
    const cat = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    })
    if (!cat) throw new AppError('Categoria não encontrada.', 404)
    return cat
  },

  async create(data: CategoryInput) {
    return prisma.category.create({ data })
  },

  async update(id: string, data: Partial<CategoryInput>) {
    await this.getById(id)
    return prisma.category.update({ where: { id }, data })
  },

  async remove(id: string) {
    const cat = await this.getById(id)
    const count = await prisma.product.count({ where: { categoryId: id } })
    if (count > 0) throw new AppError(`Esta categoria possui ${count} produto(s). Remova-os primeiro.`, 409)
    return prisma.category.delete({ where: { id: cat.id } })
  },
}
