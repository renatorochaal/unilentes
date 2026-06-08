import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { z } from 'zod'
import { paginate } from '../../shared/middleware/validate'
import { Request } from 'express'

/** Aceita URLs absolutas (http/https) e paths relativos (/uploads/...) */
const urlOrPath = z.string().refine(
  (v) => v.startsWith('/') || v.startsWith('http://') || v.startsWith('https://'),
  { message: 'URL ou caminho inválido' }
)

export const productTreatmentSchema = z.object({
  treatmentId: z.string().uuid(),
  price:       z.number().nonnegative(),
})

export const productSchema = z.object({
  code:         z.string().min(1, 'Código obrigatório.'),
  name:         z.string().min(1, 'Nome obrigatório.'),
  brandId:      z.string().uuid('Marca inválida.'),
  categoryId:   z.string().uuid('Categoria inválida.'),
  supplierId:   z.string().uuid().optional().nullable(),
  spherical:    z.string().optional().nullable(),
  cylindrical:  z.string().optional().nullable(),
  diameter:     z.string().optional().nullable(),
  addition:     z.string().optional().nullable(),
  priceNoAR:    z.number().optional().nullable(),
  height:       z.string().optional().nullable(),
  availability: z.string().optional().nullable(),
  isActive:     z.boolean().optional(),
  notes:        z.string().optional().nullable(),
  imageUrl:     urlOrPath.optional().nullable(),
  treatments:   z.array(productTreatmentSchema).optional(),
})

export type ProductInput = z.infer<typeof productSchema>

const productInclude = {
  brand:    { select: { id: true, name: true, logoUrl: true } },
  category: { select: { id: true, name: true } },
  supplier: { select: { id: true, name: true } },
  treatments: {
    include: {
      treatment: { select: { id: true, name: true } },
    },
  },
}

export const productService = {
  async list(req: Request) {
    const { skip, limit, page } = paginate(req)
    const search     = req.query.search as string | undefined
    const brandId    = req.query.brand as string | undefined
    const categoryId = req.query.category as string | undefined
    const isActive   = req.query.isActive !== undefined
      ? req.query.isActive === 'true'
      : undefined

    const where = {
      ...(search     ? { OR: [
        { code: { contains: search } },
        { name: { contains: search } },
      ]} : {}),
      ...(brandId    ? { brandId }    : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: productInclude,
      }),
      prisma.product.count({ where }),
    ])

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  },

  async getById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    })
    if (!product) throw new AppError('Produto não encontrado.', 404)
    return product
  },

  async create(input: ProductInput) {
    const { treatments, ...productData } = input
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData,
          priceNoAR: productData.priceNoAR ?? null,
        },
      })
      if (treatments?.length) {
        await tx.productTreatment.createMany({
          data: treatments.map((t) => ({
            productId:   product.id,
            treatmentId: t.treatmentId,
            price:       t.price,
          })),
        })
      }
      return tx.product.findUnique({ where: { id: product.id }, include: productInclude })
    })
  },

  async update(id: string, input: Partial<ProductInput>) {
    await this.getById(id)
    const { treatments, ...productData } = input
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: productData,
      })
      if (treatments !== undefined) {
        // Substituir todos os tratamentos
        await tx.productTreatment.deleteMany({ where: { productId: id } })
        if (treatments.length) {
          await tx.productTreatment.createMany({
            data: treatments.map((t) => ({
              productId:   product.id,
              treatmentId: t.treatmentId,
              price:       t.price,
            })),
          })
        }
      }
      return tx.product.findUnique({ where: { id: product.id }, include: productInclude })
    })
  },

  async remove(id: string) {
    await this.getById(id)
    return prisma.product.delete({ where: { id } })
  },
}
