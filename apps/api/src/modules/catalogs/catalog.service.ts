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

type CatalogSectionInput = z.infer<typeof catalogSectionSchema>

/**
 * Remove das seções produtos que não pertencem à marca/categoria do
 * catálogo — o front já faz essa limpeza, mas o backend não pode confiar
 * cegamente nos IDs recebidos (ver bug de vazamento de produto errado no
 * export por catálogo).
 */
async function sanitizeSections(
  brandId: string,
  categoryId: string,
  sections: CatalogSectionInput[] | null | undefined,
): Promise<CatalogSectionInput[] | null | undefined> {
  if (!sections?.length) return sections
  const products = await prisma.product.findMany({
    where: { brandId, categoryId },
    select: { id: true },
  })
  const validIds = new Set(products.map((p) => p.id))
  return sections.map((sec) => ({
    ...sec,
    productIds: sec.productIds.filter((id) => validIds.has(id)),
  }))
}

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
    const sections = await sanitizeSections(data.brandId, data.categoryId, data.sections)
    return prisma.catalog.create({
      data: { ...data, sections } as Parameters<typeof prisma.catalog.create>[0]['data'],
      include: {
        brand:    { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    })
  },

  async update(id: string, data: Partial<z.infer<typeof catalogSchema>>) {
    const existing = await this.getById(id)
    let sections = data.sections
    if (sections !== undefined) {
      const brandId    = data.brandId    ?? existing.brandId
      const categoryId = data.categoryId ?? existing.categoryId
      sections = await sanitizeSections(brandId, categoryId, sections)
    }
    return prisma.catalog.update({
      where: { id },
      data: { ...data, ...(sections !== undefined ? { sections } : {}) } as Parameters<typeof prisma.catalog.update>[0]['data'],
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
