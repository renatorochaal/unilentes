import type { CategoryTreatment, ProductTreatment } from '../types'

/**
 * Colunas de tratamento de uma tabela — mesma regra do PDF (api: category-treatments.ts):
 * - categoria configurada: lista configurada, na ordem definida;
 * - sem configuração: só tratamentos com preço em algum produto da tabela.
 */
export function resolveTreatmentColumns(
  configured: CategoryTreatment[] | null | undefined,
  products: { treatments: ProductTreatment[] }[],
): string[] {
  if (configured?.length) {
    return [...configured].sort((a, b) => a.sortOrder - b.sortOrder).map((ct) => ct.treatment.name)
  }
  return Array.from(
    new Set(
      products.flatMap((p) =>
        p.treatments.filter((t) => t.price != null && Number(t.price) > 0).map((t) => t.treatment.name),
      ),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
