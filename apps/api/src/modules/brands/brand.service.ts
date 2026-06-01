import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { z } from 'zod'

export const brandSchema = z.object({
  name:        z.string().min(1, 'Nome obrigatório.'),
  logoUrl:     z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  isActive:    z.boolean().optional(),
})

export type BrandInput = z.infer<typeof brandSchema>

export const brandService = {
  async list(search?: string) {
    return prisma.brand.findMany({
      where: search ? { name: { contains: search } } : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
  },

  async getById(id: string) {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    })
    if (!brand) throw new AppError('Marca não encontrada.', 404)
    return brand
  },

  async create(data: BrandInput) {
    return prisma.brand.create({ data })
  },

  async update(id: string, data: Partial<BrandInput>) {
    await this.getById(id)
    return prisma.brand.update({ where: { id }, data })
  },

  async remove(id: string) {
    const brand = await this.getById(id)
    const count = await prisma.product.count({ where: { brandId: id } })
    if (count > 0) throw new AppError(`Esta marca possui ${count} produto(s) associado(s). Remova-os primeiro.`, 409)
    return prisma.brand.delete({ where: { id: brand.id } })
  },
}
