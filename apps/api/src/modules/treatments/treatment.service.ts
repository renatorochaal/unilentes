import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { z } from 'zod'

export const treatmentSchema = z.object({
  name:     z.string().min(1, 'Nome obrigatório.'),
  isActive: z.boolean().optional(),
})

export type TreatmentInput = z.infer<typeof treatmentSchema>

export const treatmentService = {
  async list(search?: string) {
    return prisma.treatment.findMany({
      where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    })
  },

  async getById(id: string) {
    const t = await prisma.treatment.findUnique({ where: { id } })
    if (!t) throw new AppError('Tratamento não encontrado.', 404)
    return t
  },

  async create(data: TreatmentInput) {
    return prisma.treatment.create({ data })
  },

  async update(id: string, data: Partial<TreatmentInput>) {
    await this.getById(id)
    return prisma.treatment.update({ where: { id }, data })
  },

  async remove(id: string) {
    await this.getById(id)
    const count = await prisma.productTreatment.count({ where: { treatmentId: id } })
    if (count > 0) throw new AppError(`Este tratamento está em uso por ${count} produto(s).`, 409)
    return prisma.treatment.delete({ where: { id } })
  },
}
