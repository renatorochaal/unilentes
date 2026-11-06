import * as XLSX from 'xlsx'

/**
 * Leitura das planilhas de preço (.xlsx/.xlsb) enviadas pela Unilentes.
 * Cada aba mistura capa, notas, linhas de total e vários blocos de produtos,
 * e as colunas mudam de posição entre abas e blocos. Por isso as colunas são
 * localizadas pelos cabeçalhos, nunca por posição fixa.
 */

export interface SheetProduct {
  line: number
  code: string
  name: string
  spherical: string | null
  cylindrical: string | null
  diameter: string | null
  addition: string | null
  height: string | null
  priceNoAR: number | null
  prices: { treatment: string; price: number | null }[]
}

export interface ParsedSheet {
  name: string
  products: SheetProduct[]
  /** Tratamentos com preço em algum produto da aba, na ordem da planilha. */
  treatments: string[]
  /** Códigos que aparecem de novo na aba ou em aba anterior (fica a primeira ocorrência). */
  duplicates: string[]
  /** Repetidos com preço diferente do que ficou: só um pode valer, pois o código é único. */
  conflicts: { code: string; keptFrom: string }[]
  /** Colunas com preço que não são um tratamento conhecido: não são importadas. */
  ignoredColumns: { name: string; prices: number }[]
}

type Cell = string | number | boolean | null
type ColumnField = 'spherical' | 'cylindrical' | 'diameter' | 'addition' | 'priceNoAR'

interface Layout {
  code: number
  name: number
  fields: Partial<Record<ColumnField, number>>
  treatments: { col: number; name: string }[]
  ignored: { col: number; name: string }[]
}

const norm = (v: Cell | undefined) =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

/** Tratamentos usados nas planilhas; o cadastro do sistema soma-se a esta lista. */
const BASE_TREATMENTS = [
  'DV Chrome', 'DV Silver', 'DV Platinum', 'DV Gold UV',
  'Unilens', 'Unilens Extra', 'Unilens Protection', 'Lens Coating',
  'Trio Easy Clean', 'No Reflex', 'Crizal Easy', 'Crizal Easy Pro', 'Optifog', 'Crizal Rock UV',
  'Crizal Prevencia', 'Crizal Sapphire', 'Crizal Sapphire Face Interna', 'Natural Look', 'Verniz HC',
]

/** Erros de digitação e variações de nome presentes nas planilhas. */
const TREATMENT_ALIASES: Record<string, string> = {
  'dv gold': 'DV Gold UV',
  'vernz hc': 'Verniz HC',
  'trio eazy clean': 'Trio Easy Clean',
  'crizal natural look': 'Natural Look',
  'crizal sapphire in': 'Crizal Sapphire Face Interna',
  'crizal sapphrire': 'Crizal Sapphire',
}

/** Rótulos à direita do material que nunca são colunas de preço de tratamento. */
const NOT_TREATMENT = /^(-|s\/ ?ar|sem ar|c\/ ?verniz|guelta|novo preco|alterad[ao]( em)?|antirreflexo.*|com antirreflexo.*|preco.*|obs.*|coluna\d+)$/

type TreatmentResolver = (raw: string) => string | null

function treatmentResolver(known: string[]): TreatmentResolver {
  const byKey = new Map([...BASE_TREATMENTS, ...known].map((name) => [norm(name), name]))
  return (raw) => {
    const key = norm(raw)
    return TREATMENT_ALIASES[key] ?? byKey.get(key) ?? null
  }
}

function isText(v: Cell | undefined): v is string {
  return typeof v === 'string' && v.trim() !== '' && !/^[\d.,\s-]+$/.test(v)
}

function toCode(v: Cell | undefined): string | null {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 100 ? String(v) : null
  const s = String(v ?? '').trim()
  return /^\d{3,}$/.test(s) ? s : null
}

function toPrice(v: Cell | undefined): number | null {
  if (typeof v === 'number') return v > 0 ? Math.round(v * 100) / 100 : null
  const s = String(v ?? '').trim().replace(/^R\$\s*/i, '')
  if (!/^[\d.,]+$/.test(s)) return null
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
  return n > 0 ? n : null
}

function toText(v: Cell | undefined, decimals?: number): string | null {
  if (typeof v === 'number') {
    return decimals === undefined ? String(v).replace('.', ',') : v.toFixed(decimals).replace('.', ',')
  }
  const s = String(v ?? '').replace(/\s+/g, ' ').trim()
  return s === '' || s === '-' ? null : s
}

function readHeader(row: Cell[]): Layout | null {
  const cells = row.map(norm)
  const code = cells.findIndex((c) => /^cod/.test(c) && !c.includes('anterior'))
  const name = cells.indexOf('material')
  if (code === -1 || name === -1) return null

  const fields: Layout['fields'] = {}
  cells.forEach((c, i) => {
    if (i <= name) return
    if (/^(esferico|disponibilidade)/.test(c)) fields.spherical ??= i
    else if (/^cil/.test(c)) fields.cylindrical ??= i
    else if (c === 'ø' || c.startsWith('diametro')) fields.diameter ??= i
    else if (/^ad(icao|\.|$)/.test(c)) fields.addition ??= i
    else if (c === 'sem ar') fields.priceNoAR ??= i
  })
  return { code, name, fields, treatments: [], ignored: [] }
}

/**
 * Linha com os nomes dos tratamentos do bloco; às vezes traz também o "Sem AR"
 * real. Com 2+ tratamentos conhecidos ou 3+ rótulos é cabeçalho de bloco; fora
 * isso é nota solta e o layout atual continua valendo.
 */
function readTreatmentRow(row: Cell[], layout: Layout, resolve: TreatmentResolver): void {
  const treatments: Layout['treatments'] = []
  const ignored: Layout['ignored'] = []
  let noAR: number | undefined
  row.forEach((cell, col) => {
    if (col <= layout.name || !isText(cell)) return
    const key = norm(cell)
    if (key === 'sem ar') { noAR ??= col; return }
    if (NOT_TREATMENT.test(key)) return
    const name = resolve(cell)
    if (name) treatments.push({ col, name })
    else ignored.push({ col, name: cell.replace(/\s+/g, ' ').trim() })
  })
  if (treatments.length < 2 && treatments.length + ignored.length < 3) return
  layout.treatments = treatments
  layout.ignored = ignored
  if (noAR !== undefined) layout.fields.priceNoAR = noAR
}

interface SeenCode { sheet: string; priceKey: string }

function priceKey(priceNoAR: number | null, prices: SheetProduct['prices']): string {
  const priced = prices.filter((p) => p.price !== null).map((p) => `${p.treatment}=${p.price}`).sort()
  return [priceNoAR, ...priced].join('|')
}

function parseSheet(name: string, rows: Cell[][], seenCodes: Map<string, SeenCode>, resolve: TreatmentResolver): ParsedSheet {
  const products: SheetProduct[] = []
  const duplicates: string[] = []
  const conflicts: ParsedSheet['conflicts'] = []
  const priced = new Set<string>()
  const order: string[] = []
  const ignoredPrices = new Map<string, number>()
  let layout: Layout | null = null
  let height: string | null = null

  rows.forEach((row, index) => {
    const header = readHeader(row)
    if (header) { layout = header; return }

    const first = row.find((c) => c !== null && c !== '')
    const heightMatch = typeof first === 'string' ? /^alturas?(?: de montagem)?:?\s+(\d+\s*a\s*\d+)/i.exec(first.trim()) : null
    if (heightMatch) height = heightMatch[1].replace(/\s+/g, ' ')

    if (!layout) return
    const current: Layout = layout
    const code = toCode(row[current.code])
    if (!code) { readTreatmentRow(row, current, resolve); return }

    const productName = toText(row[current.name])
    if (!productName) return
    const at = (f: ColumnField) => (current.fields[f] === undefined ? undefined : row[current.fields[f]!])
    const prices = current.treatments.map((t) => ({ treatment: t.name, price: toPrice(row[t.col]) }))
    const priceNoAR = toPrice(at('priceNoAR'))

    const key = priceKey(priceNoAR, prices)
    const seen = seenCodes.get(code)
    if (seen) {
      duplicates.push(code)
      if (seen.priceKey !== key) conflicts.push({ code, keptFrom: seen.sheet })
      return
    }
    seenCodes.set(code, { sheet: name, priceKey: key })

    for (const p of prices) {
      if (!order.includes(p.treatment)) order.push(p.treatment)
      if (p.price !== null) priced.add(p.treatment)
    }
    for (const col of current.ignored) {
      if (toPrice(row[col.col]) !== null) ignoredPrices.set(col.name, (ignoredPrices.get(col.name) ?? 0) + 1)
    }
    products.push({
      line: index + 1,
      code,
      name: productName,
      spherical: toText(at('spherical')),
      cylindrical: toText(at('cylindrical'), 2),
      diameter: toText(at('diameter')),
      addition: toText(at('addition'), 2),
      height,
      priceNoAR,
      prices,
    })
  })

  return {
    name,
    products,
    treatments: order.filter((t) => priced.has(t)),
    duplicates,
    conflicts,
    ignoredColumns: [...ignoredPrices].map(([column, prices]) => ({ name: column, prices })),
  }
}

/**
 * @param knownTreatments nomes do cadastro, somados à lista base.
 * @param onlySheets limita às abas escolhidas: um código repetido fica com a
 *   primeira aba selecionada, não com uma aba que o usuário descartou.
 */
export function parseWorkbook(buf: Buffer, knownTreatments: string[], onlySheets?: string[]): ParsedSheet[] {
  const workbook = XLSX.read(buf, { type: 'buffer', cellStyles: false, cellHTML: false, cellFormula: false })
  const hidden = new Set((workbook.Workbook?.Sheets ?? []).filter((s) => s.Hidden).map((s) => s.name))
  const resolve = treatmentResolver(knownTreatments)
  const seenCodes = new Map<string, SeenCode>()
  return workbook.SheetNames
    .filter((name) => !hidden.has(name) && (!onlySheets || onlySheets.includes(name)))
    .map((name) => parseSheet(
      name,
      XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[name], { header: 1, raw: true, blankrows: true, defval: null }),
      seenCodes,
      resolve,
    ))
    .filter((sheet) => sheet.products.length > 0)
}
