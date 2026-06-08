import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { z } from 'zod'

/** Aceita URLs absolutas (http/https) e paths relativos (/uploads/...) */
const urlOrPath = z.string().refine(
  (v) => v.startsWith('/') || v.startsWith('http://') || v.startsWith('https://'),
  { message: 'URL ou caminho inválido' }
)

const columnVisibilitySchema = z.object({
  spherical:    z.boolean().optional(),
  cylindrical:  z.boolean().optional(),
  diameter:     z.boolean().optional(),
  addition:     z.boolean().optional(),
  priceNoAR:    z.boolean().optional(),
  availability: z.boolean().optional(),
}).optional().nullable()

const catalogSectionSchema = z.object({
  id:          z.string(),
  title:       z.string(),
  headerImage: urlOrPath.optional().nullable(),
  productIds:  z.array(z.string()),
})

export const catalogSchema = z.object({
  title:          z.string().min(1),
  subtitle:       z.string().optional().nullable(),
  badge:          z.string().optional().nullable(),
  brandId:        z.string().uuid(),
  categoryId:     z.string().uuid(),
  headerImage:    urlOrPath.optional().nullable(),
  description:    z.string().optional().nullable(),
  isActive:       z.boolean().optional(),
  sortOrder:      z.number().int().optional(),
  crmUrl:         urlOrPath.optional().nullable(),
  visibleColumns: columnVisibilitySchema,
  sections:       z.array(catalogSectionSchema).optional().nullable(),
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

  async listAll() {
    return prisma.catalog.findMany({
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
      data: data as Parameters<typeof prisma.catalog.create>[0]['data'],
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
      data: data as Parameters<typeof prisma.catalog.update>[0]['data'],
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
