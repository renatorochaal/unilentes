import { Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { z } from 'zod'
import { parseWorkbook, type ParsedSheet } from './product.spreadsheet'

/**
 * Importação de produtos por arquivo:
 * - CSV no layout do export: Cod. WEB, Material, Marca, Categoria, Esférico,
 *   Cil, Ø, Adição, Alturas, Disponibilidade, Sem AR, <tratamentos>, Status.
 * - Planilha .xlsx/.xlsb no formato da tabela de preços: marca e categoria não
 *   existem no arquivo, então cada aba é associada a elas (ver mapping).
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

export interface ImportRowError { line: number; sheet?: string; code?: string; message: string }

export interface ImportSheetSummary {
  name: string
  products: number
  treatments: string[]
  duplicates: number
  conflicts: number
  ignoredColumns: { name: string; prices: number }[]
  suggestedBrand: string
  suggestedCategory: string
}

export interface ImportResult {
  dryRun: boolean
  /** Planilha sem mapping: devolve as abas para o usuário associar marca e categoria. */
  needsMapping: boolean
  sheets: ImportSheetSummary[]
  total: number
  created: number
  updated: number
  treatmentColumns: string[]
  /** Cadastros que serão (ou foram) criados por createMissing. */
  newBrands: string[]
  newCategories: string[]
  newTreatments: string[]
  /** Categorias sem colunas configuradas que recebem as colunas da aba. */
  configuredCategories: string[]
  warnings: string[]
  errors: ImportRowError[]
}

export const sheetMappingSchema = z.array(z.object({
  sheet:    z.string().min(1),
  brand:    z.string().trim().min(1, 'Marca obrigatória.'),
  category: z.string().trim().min(1, 'Categoria obrigatória.'),
})).min(1, 'Selecione ao menos uma aba.')

export type SheetMapping = z.infer<typeof sheetMappingSchema>

export interface ImportOptions {
  dryRun: boolean
  createMissing: boolean
  mapping?: SheetMapping
}

type ProductFields = Pick<Prisma.ProductUncheckedUpdateInput,
  'spherical' | 'cylindrical' | 'diameter' | 'addition' | 'height' | 'availability' | 'priceNoAR' | 'isActive'>

interface ImportRecord {
  line: number
  sheet?: string
  code: string
  name: string
  brand: string
  category: string
  fields: ProductFields
  prices: { treatment: string; price: number | null }[]
}

interface ImportBatch {
  total: number
  records: ImportRecord[]
  treatments: string[]
  /** Colunas a aplicar em categorias ainda sem configuração. */
  categoryColumns: { brand: string; category: string; treatments: string[] }[]
  errors: ImportRowError[]
  warnings: string[]
}

function emptyResult(dryRun: boolean): ImportResult {
  return {
    dryRun, needsMapping: false, sheets: [], total: 0, created: 0, updated: 0, treatmentColumns: [],
    newBrands: [], newCategories: [], newTreatments: [], configuredCategories: [], warnings: [], errors: [],
  }
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

function readCsv(buf: Buffer): ImportBatch {
  const rows = parseCsv(decodeCsvBuffer(buf))
  if (rows.length < 2) throw new AppError('Arquivo vazio ou sem linhas de produto.', 400)

  const [header, ...dataRows] = rows
  const errors: ImportRowError[] = []

  // Colunas que não são campos conhecidos são tratamentos
  const fieldIndex = new Map<ProductField, number>()
  const treatmentCols: { index: number; name: string }[] = []
  header.forEach((rawHeader, index) => {
    const name = rawHeader.trim()
    if (!name) return
    const field = HEADER_ALIASES[normalizeHeader(name)]
    if (field) {
      if (fieldIndex.has(field)) errors.push({ line: 1, message: `Coluna duplicada: "${name}".` })
      fieldIndex.set(field, index)
    } else treatmentCols.push({ index, name })
  })
  for (const f of REQUIRED_FIELDS) {
    if (!fieldIndex.has(f)) errors.push({ line: 1, message: `Coluna obrigatória ausente: ${f === 'code' ? 'Cod. WEB' : f === 'name' ? 'Material' : f === 'brand' ? 'Marca' : 'Categoria'}.` })
  }

  const batch: ImportBatch = {
    total: dataRows.length, records: [], treatments: treatmentCols.map((t) => t.name),
    categoryColumns: [], errors, warnings: [],
  }
  if (errors.length) return batch

  const cell = (row: string[], f: ProductField) => {
    const i = fieldIndex.get(f)
    return i === undefined ? undefined : (row[i] ?? '')
  }
  const seenCodes = new Map<string, number>()

  dataRows.forEach((row, i) => {
    const line = i + 2
    const rowErrors: string[] = []
    const code = (cell(row, 'code') ?? '').trim()
    const name = (cell(row, 'name') ?? '').trim()
    const brand = (cell(row, 'brand') ?? '').trim()
    const category = (cell(row, 'category') ?? '').trim()

    if (!code) rowErrors.push('Cod. WEB vazio.')
    if (!name) rowErrors.push('Material vazio.')
    if (!brand) rowErrors.push('Marca vazia.')
    if (!category) rowErrors.push('Categoria vazia.')
    if (code && seenCodes.has(code)) rowErrors.push(`Cod. WEB repetido no arquivo (linha ${seenCodes.get(code)}).`)
    if (code) seenCodes.set(code, line)

    const fields: ProductFields = {}
    for (const f of ['spherical', 'cylindrical', 'diameter', 'addition', 'height', 'availability'] as const) {
      const v = cell(row, f)
      if (v !== undefined) fields[f] = nullable(v)
    }
    const noAR = cell(row, 'priceNoAR')
    if (noAR !== undefined) {
      const price = parsePrice(noAR)
      if (Number.isNaN(price)) rowErrors.push(`Sem AR inválido: "${noAR}".`)
      else fields.priceNoAR = price
    }
    const status = cell(row, 'status')
    if (status !== undefined && status.trim() !== '') {
      const s = normalizeHeader(status)
      if (s === 'ativo') fields.isActive = true
      else if (s === 'inativo') fields.isActive = false
      else rowErrors.push(`Status inválido: "${status}" (use Ativo ou Inativo).`)
    }

    const prices = treatmentCols.map((tc) => {
      const raw = row[tc.index] ?? ''
      const price = parsePrice(raw)
      if (Number.isNaN(price)) rowErrors.push(`Preço inválido em "${tc.name}": "${raw}".`)
      return { treatment: tc.name, price: price && price > 0 ? price : null }
    })

    rowErrors.forEach((message) => errors.push({ line, code: code || undefined, message }))
    if (!rowErrors.length) batch.records.push({ line, code, name, brand, category, fields, prices })
  })
  return batch
}

function groupConflicts(sheet: ParsedSheet): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const c of sheet.conflicts) groups.set(c.keptFrom, [...(groups.get(c.keptFrom) ?? []), c.code])
  return groups
}

function readWorkbook(sheets: ParsedSheet[], mapping: SheetMapping): ImportBatch {
  const batch: ImportBatch = { total: 0, records: [], treatments: [], categoryColumns: [], errors: [], warnings: [] }

  for (const sheet of sheets) {
    const target = mapping.find((m) => m.sheet === sheet.name)!
    batch.total += sheet.products.length
    for (const t of sheet.treatments) if (!batch.treatments.includes(t)) batch.treatments.push(t)

    const columns = batch.categoryColumns.find((c) =>
      normalizeHeader(c.brand) === normalizeHeader(target.brand) &&
      normalizeHeader(c.category) === normalizeHeader(target.category))
    if (columns) {
      for (const t of sheet.treatments) if (!columns.treatments.includes(t)) columns.treatments.push(t)
    } else {
      batch.categoryColumns.push({ brand: target.brand, category: target.category, treatments: [...sheet.treatments] })
    }

    if (sheet.duplicates.length) {
      batch.warnings.push(`${sheet.name}: ${sheet.duplicates.length} código(s) repetido(s) ignorado(s); vale a primeira ocorrência.`)
    }
    for (const [keptFrom, codes] of groupConflicts(sheet)) {
      const sample = codes.slice(0, 5).join(', ')
      batch.warnings.push(`${sheet.name}: ${codes.length} código(s) com PREÇO DIFERENTE de "${keptFrom}", que foi mantida (ex.: ${sample}).`)
    }
    for (const col of sheet.ignoredColumns) {
      batch.warnings.push(`${sheet.name}: coluna "${col.name}" não importada (${col.prices} preço(s)).`)
    }
    for (const p of sheet.products) {
      batch.records.push({
        line: p.line,
        sheet: sheet.name,
        code: p.code,
        name: p.name,
        brand: target.brand,
        category: target.category,
        fields: {
          spherical: p.spherical, cylindrical: p.cylindrical, diameter: p.diameter,
          addition: p.addition, height: p.height, priceNoAR: p.priceNoAR,
        },
        prices: p.prices,
      })
    }
  }
  return batch
}

function suggestBrand(sheetName: string, brands: string[]): string {
  const key = normalizeHeader(sheetName)
  const existing = brands.find((b) => key.includes(normalizeHeader(b)))
  if (existing) return existing
  if (key.includes('zeiss')) return 'ZEISS'
  if (key.includes('kodak')) return 'KODAK'
  if (key.includes('hoya')) return 'HOYA'
  if (key.includes('essilor') || key.includes('varilux')) return 'ESSILOR'
  return 'UNILENTES'
}

async function applyBatch(batch: ImportBatch, { dryRun, createMissing }: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    ...emptyResult(dryRun),
    total: batch.total,
    treatmentColumns: batch.treatments,
    warnings: batch.warnings,
    errors: batch.errors,
  }
  if (batch.errors.some((e) => e.line === 1 && !e.sheet)) return result

  const [brands, categories, treatments, existingProducts] = await Promise.all([
    prisma.brand.findMany({ select: { id: true, name: true } }),
    prisma.category.findMany({ select: { id: true, name: true, brandId: true, _count: { select: { treatments: true } } } }),
    prisma.treatment.findMany({ select: { id: true, name: true } }),
    prisma.product.findMany({ select: { id: true, code: true } }),
  ])
  const brandByKey = new Map(brands.map((b) => [normalizeHeader(b.name), b]))
  const treatmentByKey = new Map(treatments.map((t) => [normalizeHeader(t.name), t]))
  const productIdByCode = new Map(existingProducts.map((p) => [p.code, p.id]))
  const findCategory = (name: string, brandId: string | undefined) => {
    const key = normalizeHeader(name)
    return categories.find((c) => c.brandId === brandId && normalizeHeader(c.name) === key)
      ?? categories.find((c) => c.brandId === null && normalizeHeader(c.name) === key)
  }

  // ── Cadastros que faltam ───────────────────────────────────────────
  const missingBrands = new Map<string, string>()
  const missingCategories = new Map<string, { brand: string; category: string }>()
  const missingTreatments = new Map<string, string>()
  for (const name of batch.treatments) {
    if (treatmentByKey.has(normalizeHeader(name))) continue
    if (createMissing) missingTreatments.set(normalizeHeader(name), name)
    else result.errors.push({ line: 1, message: `Tratamento "${name}" não cadastrado.` })
  }

  const categoryKey = (brand: string, category: string) => `${normalizeHeader(brand)}||${normalizeHeader(category)}`
  for (const r of batch.records) {
    const brand = brandByKey.get(normalizeHeader(r.brand))
    if (!brand) {
      if (createMissing) missingBrands.set(normalizeHeader(r.brand), r.brand)
      else result.errors.push({ line: r.line, sheet: r.sheet, code: r.code, message: `Marca "${r.brand}" não cadastrada.` })
    }
    if (!findCategory(r.category, brand?.id) && (brand || createMissing)) {
      if (createMissing) missingCategories.set(categoryKey(r.brand, r.category), { brand: r.brand, category: r.category })
      else result.errors.push({ line: r.line, sheet: r.sheet, code: r.code, message: `Categoria "${r.category}" não cadastrada para a marca ${brand!.name}.` })
    }
  }
  result.newBrands = [...missingBrands.values()]
  result.newCategories = [...missingCategories.values()].map((c) => `${c.brand} / ${c.category}`)
  result.newTreatments = [...missingTreatments.values()]

  const columnsToConfigure = batch.categoryColumns.filter((c) => {
    if (!c.treatments.length) return false
    const found = findCategory(c.category, brandByKey.get(normalizeHeader(c.brand))?.id)
    return !found || found._count.treatments === 0
  })
  result.configuredCategories = columnsToConfigure.map((c) => `${c.brand} / ${c.category}`)

  const created = batch.records.filter((r) => !productIdByCode.has(r.code)).length
  if (result.errors.length) return result
  result.created = created
  result.updated = batch.records.length - created
  if (dryRun) return result

  await prisma.$transaction(async (tx) => {
    for (const [key, name] of missingBrands) {
      brandByKey.set(key, await tx.brand.create({ data: { name }, select: { id: true, name: true } }))
    }
    for (const [key, name] of missingTreatments) {
      treatmentByKey.set(key, await tx.treatment.create({ data: { name }, select: { id: true, name: true } }))
    }
    const newCategoryIds = new Map<string, string>()
    for (const [key, c] of missingCategories) {
      const brandId = brandByKey.get(normalizeHeader(c.brand))!.id
      newCategoryIds.set(key, (await tx.category.create({ data: { name: c.category, brandId } })).id)
    }
    const categoryIdOf = (brand: string, category: string) =>
      newCategoryIds.get(categoryKey(brand, category))
        ?? findCategory(category, brandByKey.get(normalizeHeader(brand))?.id)!.id

    for (const c of columnsToConfigure) {
      await tx.categoryTreatment.createMany({
        data: c.treatments.map((name, sortOrder) => ({
          categoryId: categoryIdOf(c.brand, c.category),
          treatmentId: treatmentByKey.get(normalizeHeader(name))!.id,
          sortOrder,
        })),
      })
    }

    for (const r of batch.records) {
      const data: Prisma.ProductUncheckedUpdateInput = {
        ...r.fields,
        code: r.code,
        name: r.name,
        brandId: brandByKey.get(normalizeHeader(r.brand))!.id,
        categoryId: categoryIdOf(r.brand, r.category),
      }
      const existingId = productIdByCode.get(r.code)
      const product = existingId
        ? await tx.product.update({ where: { id: existingId }, data })
        : await tx.product.create({ data: data as Prisma.ProductUncheckedCreateInput })

      if (!r.prices.length) continue
      const ids = r.prices.map((p) => ({ id: treatmentByKey.get(normalizeHeader(p.treatment))?.id, price: p.price }))
      await tx.productTreatment.deleteMany({
        where: { productId: product.id, treatmentId: { in: ids.flatMap((t) => (t.id ? [t.id] : [])) } },
      })
      const byTreatment = new Map(ids.flatMap((t) => (t.id && t.price !== null ? [[t.id, t.price] as const] : [])))
      if (byTreatment.size) {
        await tx.productTreatment.createMany({
          data: [...byTreatment].map(([treatmentId, price]) => ({ productId: product.id, treatmentId, price })),
        })
      }
    }
  }, { timeout: 180_000, maxWait: 10_000 })

  return result
}

export async function importProductsFile(file: { buffer: Buffer; originalname: string }, options: ImportOptions): Promise<ImportResult> {
  if (/\.csv$/i.test(file.originalname)) return applyBatch(readCsv(file.buffer), options)

  const known = (await prisma.treatment.findMany({ select: { name: true } })).map((t) => t.name)
  const onlySheets = options.mapping?.map((m) => m.sheet)
  let sheets: ParsedSheet[]
  try {
    sheets = parseWorkbook(file.buffer, known, onlySheets)
  } catch {
    throw new AppError('Não foi possível ler a planilha. Confira se o arquivo está íntegro.', 400)
  }
  if (!sheets.length) throw new AppError('Nenhuma aba com produtos encontrada no arquivo.', 400)

  if (options.mapping) return applyBatch(readWorkbook(sheets, options.mapping), options)

  const brands = (await prisma.brand.findMany({ select: { name: true } })).map((b) => b.name)
  return {
    ...emptyResult(options.dryRun),
    needsMapping: true,
    total: sheets.reduce((sum, s) => sum + s.products.length, 0),
    sheets: sheets.map((s) => ({
      name: s.name,
      products: s.products.length,
      treatments: s.treatments,
      duplicates: s.duplicates.length,
      conflicts: s.conflicts.length,
      ignoredColumns: s.ignoredColumns,
      suggestedBrand: suggestBrand(s.name, brands),
      suggestedCategory: s.name.trim(),
    })),
  }
}
