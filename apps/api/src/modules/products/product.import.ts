import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'

/**
 * Importação de produtos via CSV no mesmo layout do export CSV:
 * Cod. WEB, Material, Marca, Categoria, Esférico, Cil, Ø, Adição, Alturas,
 * Disponibilidade, Sem AR, <uma coluna por tratamento>, Status.
 *
 * - Upsert pelo Cod. WEB.
 * - Tudo ou nada: qualquer erro de validação impede a gravação.
 * - Colunas ausentes no arquivo não alteram o produto existente; tratamentos
 *   que não têm coluna no arquivo são preservados.
 */

type ProductField =
  | 'code' | 'name' | 'brand' | 'category' | 'spherical' | 'cylindrical'
  | 'diameter' | 'addition' | 'height' | 'availability' | 'priceNoAR' | 'status'

const HEADER_ALIASES: Record<string, ProductField> = {
  'cod. web': 'code', 'cod web': 'code', 'codigo web': 'code', 'cod.web': 'code', 'codigo': 'code', 'cod': 'code',
  'material': 'name', 'nome': 'name',
  'marca': 'brand',
  'categoria': 'category',
  'esferico': 'spherical',
  'cil': 'cylindrical', 'cilindrico': 'cylindrical',
  'ø': 'diameter', 'diametro': 'diameter',
  'adicao': 'addition', 'ad.': 'addition',
  'alturas': 'height', 'altura': 'height',
  'disponibilidade': 'availability',
  'sem ar': 'priceNoAR',
  'status': 'status',
}

const REQUIRED_FIELDS: ProductField[] = ['code', 'name', 'brand', 'category']

export interface ImportRowError { line: number; code?: string; message: string }

export interface ImportResult {
  dryRun: boolean
  total: number
  created: number
  updated: number
  treatmentColumns: string[]
  errors: ImportRowError[]
}

function normalizeHeader(h: string): string {
  return h.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Excel pt-BR salva CSV em Windows-1252 por padrão; "CSV UTF-8" vem com BOM. */
export function decodeCsvBuffer(buf: Buffer): string {
  const utf8 = buf.toString('utf8')
  const text = utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8
  return text.replace(/^﻿/, '')
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const outsideQuotes = firstLine.replace(/"[^"]*"/g, '')
  const counts = [';', ',', '\t'].map((d) => [d, outsideQuotes.split(d).length - 1] as const)
  counts.sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

/** Parser RFC 4180: aspas, aspas escapadas ("") e quebras de linha dentro de aspas. */
export function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delimiter) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

/**
 * Preço em formato BR ("1.234,56", "1234,56") ou ponto decimal ("1234.56").
 * "1.234" é tratado como milhar (padrão da planilha de preços).
 * Retorna null para vazio/"-" e NaN para valor inválido.
 */
export function parsePrice(raw: string): number | null {
  const v = raw.trim().replace(/^R\$\s*/i, '')
  if (v === '' || v === '-') return null
  let normalized: string
  if (v.includes(',')) normalized = v.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) normalized = v.replace(/\./g, '')
  else normalized = v
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN
}

const nullable = (v: string) => (v.trim() === '' || v.trim() === '-' ? null : v.trim())

export async function importProductsCsv(buf: Buffer, dryRun: boolean): Promise<ImportResult> {
  const rows = parseCsv(decodeCsvBuffer(buf))
  if (rows.length < 2) throw new AppError('Arquivo vazio ou sem linhas de produto.', 400)

  const [header, ...dataRows] = rows
  const errors: ImportRowError[] = []

  // ── Mapeamento de colunas ───────────────────────────────────────────
  const fieldIndex = new Map<ProductField, number>()
  const treatmentHeaders: { index: number; name: string }[] = []
  header.forEach((rawHeader, index) => {
    const name = rawHeader.trim()
    if (!name) return
    const field = HEADER_ALIASES[normalizeHeader(name)]
    if (field) {
      if (fieldIndex.has(field)) errors.push({ line: 1, message: `Coluna duplicada: "${name}".` })
      fieldIndex.set(field, index)
    } else treatmentHeaders.push({ index, name })
  })
  for (const f of REQUIRED_FIELDS) {
    if (!fieldIndex.has(f)) errors.push({ line: 1, message: `Coluna obrigatória ausente: ${f === 'code' ? 'Cod. WEB' : f === 'name' ? 'Material' : f === 'brand' ? 'Marca' : 'Categoria'}.` })
  }

  // Colunas não reconhecidas são tratamentos — precisam existir no cadastro
  const treatments = await prisma.treatment.findMany({ select: { id: true, name: true } })
  const treatmentByName = new Map(treatments.map((t) => [normalizeHeader(t.name), t]))
  const treatmentCols: { index: number; id: string; name: string }[] = []
  for (const th of treatmentHeaders) {
    const t = treatmentByName.get(normalizeHeader(th.name))
    if (!t) errors.push({ line: 1, message: `Coluna "${th.name}" não é um campo conhecido nem um tratamento cadastrado.` })
    else treatmentCols.push({ index: th.index, id: t.id, name: t.name })
  }

  if (errors.length) {
    return { dryRun, total: dataRows.length, created: 0, updated: 0, treatmentColumns: [], errors }
  }

  // ── Lookups ────────────────────────────────────────────────────────
  const [brands, categories, existingProducts] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, name: true, brandId: true } }),
    prisma.product.findMany({ select: { id: true, code: true } }),
  ])
  const brandByName = new Map(brands.map((b) => [normalizeHeader(b.name), b]))
  const productIdByCode = new Map(existingProducts.map((p) => [p.code, p.id]))
  function findCategory(name: string, brandId: string) {
    const key = normalizeHeader(name)
    return categories.find((c) => c.brandId === brandId && normalizeHeader(c.name) === key)
      ?? categories.find((c) => c.brandId === null && normalizeHeader(c.name) === key)
  }

  const cell = (row: string[], f: ProductField) => {
    const i = fieldIndex.get(f)
    return i === undefined ? undefined : (row[i] ?? '')
  }

  interface ParsedRow {
    line: number
    code: string
    existingId?: string
    data: Prisma.ProductUncheckedUpdateInput
    treatmentPrices: { treatmentId: string; price: number | null }[]
  }
  const parsed: ParsedRow[] = []
  const seenCodes = new Map<string, number>()

  dataRows.forEach((row, i) => {
    const line = i + 2
    const rowErrors: string[] = []
    const code = (cell(row, 'code') ?? '').trim()
    const name = (cell(row, 'name') ?? '').trim()
    const brandName = (cell(row, 'brand') ?? '').trim()
    const categoryName = (cell(row, 'category') ?? '').trim()

    if (!code) rowErrors.push('Cod. WEB vazio.')
    if (!name) rowErrors.push('Material vazio.')
    if (code && seenCodes.has(code)) rowErrors.push(`Cod. WEB repetido no arquivo (linha ${seenCodes.get(code)}).`)
    if (code) seenCodes.set(code, line)

    const brand = brandName ? brandByName.get(normalizeHeader(brandName)) : undefined
    if (!brandName) rowErrors.push('Marca vazia.')
    else if (!brand) rowErrors.push(`Marca "${brandName}" não cadastrada.`)

    const category = brand && categoryName ? findCategory(categoryName, brand.id) : undefined
    if (!categoryName) rowErrors.push('Categoria vazia.')
    else if (brand && !category) rowErrors.push(`Categoria "${categoryName}" não cadastrada para a marca ${brand.name}.`)

    const data: Prisma.ProductUncheckedUpdateInput = { code, name }
    if (brand) data.brandId = brand.id
    if (category) data.categoryId = category.id
    for (const f of ['spherical', 'cylindrical', 'diameter', 'addition', 'height', 'availability'] as const) {
      const v = cell(row, f)
      if (v !== undefined) data[f] = nullable(v)
    }
    const noAR = cell(row, 'priceNoAR')
    if (noAR !== undefined) {
      const price = parsePrice(noAR)
      if (Number.isNaN(price)) rowErrors.push(`Sem AR inválido: "${noAR}".`)
      else data.priceNoAR = price
    }
    const status = cell(row, 'status')
    if (status !== undefined && status.trim() !== '') {
      const s = normalizeHeader(status)
      if (s === 'ativo') data.isActive = true
      else if (s === 'inativo') data.isActive = false
      else rowErrors.push(`Status inválido: "${status}" (use Ativo ou Inativo).`)
    }

    const treatmentPrices = treatmentCols.map((tc) => {
      const raw = row[tc.index] ?? ''
      const price = parsePrice(raw)
      if (Number.isNaN(price)) rowErrors.push(`Preço inválido em "${tc.name}": "${raw}".`)
      return { treatmentId: tc.id, price: price && price > 0 ? price : null }
    })

    rowErrors.forEach((message) => errors.push({ line, code: code || undefined, message }))
    if (!rowErrors.length) {
      parsed.push({ line, code, existingId: productIdByCode.get(code), data, treatmentPrices })
    }
  })

  const toCreate = parsed.filter((p) => !p.existingId).length
  const result: ImportResult = {
    dryRun,
    total: dataRows.length,
    created: toCreate,
    updated: parsed.length - toCreate,
    treatmentColumns: treatmentCols.map((t) => t.name),
    errors,
  }
  if (dryRun || errors.length) return errors.length ? { ...result, created: 0, updated: 0 } : result

  const treatmentIdsInFile = treatmentCols.map((t) => t.id)
  await prisma.$transaction(async (tx) => {
    for (const row of parsed) {
      const product = row.existingId
        ? await tx.product.update({ where: { id: row.existingId }, data: row.data })
        : await tx.product.create({
            // brandId/categoryId garantidos pela validação acima
            data: row.data as Prisma.ProductUncheckedCreateInput,
          })
      if (treatmentIdsInFile.length) {
        await tx.productTreatment.deleteMany({
          where: { productId: product.id, treatmentId: { in: treatmentIdsInFile } },
        })
        const withPrice = row.treatmentPrices.filter((t) => t.price !== null)
        if (withPrice.length) {
          await tx.productTreatment.createMany({
            data: withPrice.map((t) => ({ productId: product.id, treatmentId: t.treatmentId, price: t.price! })),
          })
        }
      }
    }
  }, { timeout: 120_000, maxWait: 10_000 })

  return result
}
