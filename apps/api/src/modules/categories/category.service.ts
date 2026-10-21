import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { z } from 'zod'
import { categoryTreatmentsInclude } from './category-treatments'

export const categorySchema = z.object({
  name:         z.string().min(1, 'Nome obrigatório.'),
  description:  z.string().optional().nullable(),
  brandId:      z.string().optional().nullable(),
  isActive:     z.boolean().optional(),
  // Ordem do array = ordem das colunas de tratamento nas tabelas/PDF.
  treatmentIds: z.array(z.string().uuid())
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Tratamento repetido.' })
    .optional(),
})

export type CategoryInput = z.infer<typeof categorySchema>

const categoryInclude = {
  _count: { select: { products: true } },
  treatments: categoryTreatmentsInclude,
}

export const categoryService = {
  async list(search?: string, brandId?: string) {
    return prisma.category.findMany({
      where: {
        ...(search ? { name: { contains: search } } : {}),
        ...(brandId ? { brandId } : {}),
      },
      orderBy: { name: 'asc' },
      include: categoryInclude,
    })
  },

  async getById(id: string) {
    const cat = await prisma.category.findUnique({
      where: { id },
      include: categoryInclude,
    })
    if (!cat) throw new AppError('Categoria não encontrada.', 404)
    return cat
  },

  async create(input: CategoryInput) {
    const { treatmentIds, ...data } = input
    await assertTreatmentsExist(treatmentIds)
    return prisma.category.create({
      data: {
        ...data,
        ...(treatmentIds?.length
          ? { treatments: { create: treatmentIds.map((treatmentId, sortOrder) => ({ treatmentId, sortOrder })) } }
          : {}),
      },
      include: categoryInclude,
    })
  },

  async update(id: string, input: Partial<CategoryInput>) {
    await this.getById(id)
    const { treatmentIds, ...data } = input
    await assertTreatmentsExist(treatmentIds)
    return prisma.$transaction(async (tx) => {
      if (treatmentIds !== undefined) {
        // Substitui a configuração inteira para refletir a nova ordem
        await tx.categoryTreatment.deleteMany({ where: { categoryId: id } })
        if (treatmentIds.length) {
          await tx.categoryTreatment.createMany({
            data: treatmentIds.map((treatmentId, sortOrder) => ({ categoryId: id, treatmentId, sortOrder })),
          })
        }
      }
      return tx.category.update({ where: { id }, data, include: categoryInclude })
    })
  },

  async remove(id: string) {
    const cat = await this.getById(id)
    const count = await prisma.product.count({ where: { categoryId: id } })
    if (count > 0) throw new AppError(`Esta categoria possui ${count} produto(s). Remova-os primeiro.`, 409)
    return prisma.category.delete({ where: { id: cat.id } })
  },
}

async function assertTreatmentsExist(treatmentIds: string[] | undefined) {
  if (!treatmentIds?.length) return
  const found = await prisma.treatment.count({ where: { id: { in: treatmentIds } } })
  if (found !== treatmentIds.length) throw new AppError('Tratamento inválido na configuração da categoria.', 400)
}
