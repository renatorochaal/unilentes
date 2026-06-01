import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { z } from 'zod'

export const supplierSchema = z.object({
  name:     z.string().min(1, 'Nome obrigatório.'),
  cnpj:     z.string().optional().nullable(),
  email:    z.string().email().optional().nullable(),
  phone:    z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

export type SupplierInput = z.infer<typeof supplierSchema>

export const supplierService = {
  async list(search?: string) {
    return prisma.supplier.findMany({
      where: search ? { name: { contains: search } } : undefined,
      orderBy: { name: 'asc' },
    })
  },

  async getById(id: string) {
    const s = await prisma.supplier.findUnique({ where: { id } })
    if (!s) throw new AppError('Fornecedor não encontrado.', 404)
    return s
  },

  async create(data: SupplierInput) {
    return prisma.supplier.create({ data })
  },

  async update(id: string, data: Partial<SupplierInput>) {
    await this.getById(id)
    return prisma.supplier.update({ where: { id }, data })
  },

  async remove(id: string) {
    await this.getById(id)
    return prisma.supplier.delete({ where: { id } })
  },
}
