import { Prisma } from '@prisma/client'

/** Include padrão para trazer as colunas de tratamento configuradas de uma categoria, já ordenadas. */
export const categoryTreatmentsInclude = {
  orderBy: { sortOrder: 'asc' },
  include: { treatment: { select: { id: true, name: true } } },
} satisfies Prisma.Category$treatmentsArgs

interface ProductTreatmentLike {
  price: Prisma.Decimal | number | string | null
  treatment: { name: string }
}

/**
 * Define quais colunas de tratamento uma tabela exibe.
 * - Categoria configurada: exatamente a lista configurada, na ordem definida.
 * - Sem configuração: apenas tratamentos com preço em algum produto da tabela
 *   (nunca a união global de todas as categorias do export).
 */
export function resolveTreatmentColumns(
  configured: { treatment: { name: string } }[] | null | undefined,
  products: { treatments: ProductTreatmentLike[] }[],
): string[] {
  if (configured?.length) return configured.map((ct) => ct.treatment.name)
  return Array.from(
    new Set(
      products.flatMap((p) =>
        p.treatments.filter((t) => t.price != null && Number(t.price) > 0).map((t) => t.treatment.name),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
