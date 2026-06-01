import { Prisma } from '@prisma/client'

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    brand:    { select: { name: true } }
    category: { select: { name: true } }
    treatments: {
      include: { treatment: { select: { name: true } } }
    }
  }
}>

function formatPrice(val: Prisma.Decimal | null | undefined): string {
  if (val == null) return '-'
  return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export function generateCsv(products: ProductWithRelations[]): string {
  // Coletar todos os nomes de tratamentos únicos
  const treatmentNames = Array.from(
    new Set(
      products.flatMap((p) => p.treatments.map((t) => t.treatment.name))
    )
  ).sort()

  // Header
  const headers = [
    'Cod. WEB',
    'Material',
    'Marca',
    'Categoria',
    'Esférico',
    'Cil',
    'Ø',
    'Adição',
    'Alturas',
    'Disponibilidade',
    'Sem AR',
    ...treatmentNames,
    'Status',
  ]

  const rows: string[][] = [headers]

  for (const p of products) {
    const treatmentPrices = Object.fromEntries(
      p.treatments.map((t) => [t.treatment.name, formatPrice(t.price)])
    )

    rows.push([
      p.code,
      p.name,
      p.brand.name,
      p.category.name,
      p.spherical    ?? '',
      p.cylindrical  ?? '',
      p.diameter     ?? '',
      p.addition     ?? '',
      p.height       ?? '',
      p.availability ?? '',
      formatPrice(p.priceNoAR),
      ...treatmentNames.map((tn) => treatmentPrices[tn] ?? '-'),
      p.isActive ? 'Ativo' : 'Inativo',
    ])
  }

  return rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n')
}
