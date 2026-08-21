import { Prisma } from '@prisma/client'
import path from 'path'
import fs from 'fs'

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    brand:    { select: { id: true; name: true } }
    category: { select: { id: true; name: true } }
    treatments: {
      include: { treatment: { select: { name: true } } }
    }
  }
}>

export interface CatalogSection {
  id: string
  title: string
  headerImage?: string | null
  productIds: string[]
}

export interface CatalogExportMeta {
  title: string
  subtitle?: string | null
  badge?: string | null
  sections?: CatalogSection[] | null
  headerImage?: string | null
  brandId?: string | null
  brandName?: string | null
  brandLogoUrl?: string | null
  categoryId?: string | null
  categoryName?: string | null
}

function formatPrice(val: Prisma.Decimal | null | undefined): string {
  if (val == null) return '-'
  const n = Number(val)
  if (n === 0) return '-'
  const [intPart, decPart] = n.toFixed(2).split('.')
  return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decPart}`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function resolveImageToBase64(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    if (url.startsWith('/uploads/')) {
      const localPath = path.resolve('./uploads', url.replace(/^\/uploads\//, ''))
      if (fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath)
        const ext = path.extname(localPath).slice(1) || 'png'
        const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
        return `data:${mime};base64,${buf.toString('base64')}`
      }
    }
    if (url.startsWith('http')) return url
  } catch { /* ignore */ }
  return null
}


async function loadPuppeteer() {
  const mod = await Function('return import("puppeteer")')() as typeof import('puppeteer')
  return mod.default ?? mod
}

export function buildPdfHtml(
  products: ProductWithRelations[],
  catalogMeta?: CatalogExportMeta | CatalogExportMeta[],
  headerImageUrl?: string | null,
): string {
  const catalogMetas = catalogMeta
    ? (Array.isArray(catalogMeta) ? catalogMeta : [catalogMeta])
    : []
  const effectiveImageUrl = headerImageUrl
    ?? (!Array.isArray(catalogMeta) ? catalogMeta?.headerImage : null)
    ?? null
  const heroImage = resolveImageToBase64(effectiveImageUrl)

  const treatmentNames = Array.from(
    new Set(products.flatMap((p) => p.treatments.map((t) => t.treatment.name)))
  ).sort()
  const hasTreatments = treatmentNames.length > 0
  const arCount = treatmentNames.length

  interface RenderTable {
    title?: string | null
    badge?: string | null
    items: ProductWithRelations[]
  }
  interface RenderGroup { title: string; tables: RenderTable[] }
  const groups: RenderGroup[] = []

  const productGroups = new Map<string, {
    brandId: string
    categoryId: string
    brandName: string
    categoryName: string
    items: ProductWithRelations[]
  }>()

  for (const product of products) {
    const key = `${product.brand.id}||${product.category.id}`
    if (!productGroups.has(key)) {
      productGroups.set(key, {
        brandId: product.brand.id,
        categoryId: product.category.id,
        brandName: product.brand.name,
        categoryName: product.category.name,
        items: [],
      })
    }
    productGroups.get(key)!.items.push(product)
  }

  for (const productGroup of productGroups.values()) {
    const meta = catalogMetas.find((candidate) =>
      (candidate.brandId
        ? candidate.brandId === productGroup.brandId
        : candidate.brandName === productGroup.brandName) &&
      (candidate.categoryId
        ? candidate.categoryId === productGroup.categoryId
        : candidate.categoryName === productGroup.categoryName)
    )
    const tables: RenderTable[] = []

    if (meta?.sections?.length) {
      const productsById = new Map(productGroup.items.map((product) => [product.id, product]))
      const assignedProductIds = new Set<string>()

      for (const section of meta.sections) {
        const items = section.productIds
          .map((id) => productsById.get(id))
          .filter((product): product is ProductWithRelations => !!product)
        if (!items.length) continue

        items.forEach((product) => assignedProductIds.add(product.id))
        tables.push({ title: section.title || meta.subtitle || meta.title, badge: meta.badge, items })
      }

      // Mantém no PDF produtos que ainda não foram associados a uma linha.
      const unassignedItems = productGroup.items.filter((product) => !assignedProductIds.has(product.id))
      if (unassignedItems.length) {
        tables.push({ title: meta.subtitle || meta.title, badge: meta.badge, items: unassignedItems })
      }
    } else {
      tables.push({ title: meta?.subtitle || meta?.title, badge: meta?.badge, items: productGroup.items })
    }

    groups.push({
      title: `${productGroup.brandName} — ${productGroup.categoryName}`,
      tables,
    })
  }

  function renderTable(table: RenderTable): string {
    const rows = table.items.map((p, i) => {
      const pm = Object.fromEntries(p.treatments.map((t) => [t.treatment.name, t.price]))
      const cls = i % 2 === 0 ? 'ze' : 'zo'
      return `<tr class="${cls}">
        <td class="cc">${esc(p.code)}</td>
        <td class="cm">${esc(p.name)}</td>
        <td class="cs">${esc(p.spherical ?? '-')}</td>
        <td class="cy">${esc(p.cylindrical ?? '-')}</td>
        <td class="cd">${esc(p.diameter ?? '-')}</td>
        <td class="ca">${esc(p.addition ?? '-')}</td>
        <td class="cn">${formatPrice(p.priceNoAR)}</td>
        ${treatmentNames.map(tn => `<td class="cp">${pm[tn] != null ? formatPrice(pm[tn]) : '-'}</td>`).join('')}
      </tr>`
    }).join('')

    // Header: 2 rows quando há tratamentos, 1 row caso contrário
    // Row 1: colunas fixas com rowspan=2 + "COM ANTIRREFLEXO (AR)" colspan=N
    // Row 2: nomes individuais dos tratamentos
    const theadHtml = hasTreatments
      ? `<tr class="hdr1">
          <th rowspan="2" class="hl" style="width:70px">Cod. WEB</th>
          <th rowspan="2" class="hl" style="width:auto">MATERIAL</th>
          <th rowspan="2" class="hl" style="width:180px">ESFÉRICO</th>
          <th rowspan="2" style="width:55px">CIL</th>
          <th rowspan="2" style="width:45px">Ø</th>
          <th rowspan="2" class="hl" style="width:90px">ADIÇÃO</th>
          <th rowspan="2" style="width:60px">SEM AR</th>
          <th colspan="${arCount}" class="ar-top">COM ANTIRREFLEXO (AR)</th>
        </tr>
        <tr class="hdr2">
          ${treatmentNames.map(tn => `<th class="ar-sub">${esc(tn.toUpperCase())}</th>`).join('')}
        </tr>`
      : `<tr class="hdr1">
          <th class="hl" style="width:70px">Cod. WEB</th>
          <th class="hl" style="width:auto">MATERIAL</th>
          <th class="hl" style="width:180px">ESFÉRICO</th>
          <th style="width:55px">CIL</th>
          <th style="width:45px">Ø</th>
          <th class="hl" style="width:90px">ADIÇÃO</th>
          <th style="width:60px">SEM AR</th>
        </tr>`

    return `
    <div class="section">
      ${table.title || table.badge ? `<div class="line-title">
        ${table.title ? `<h2>${esc(table.title)}</h2>` : ''}
        ${table.badge ? `<span class="pill">${esc(table.badge.toUpperCase())}</span>` : ''}
      </div>` : ''}
      <table>
        <thead>${theadHtml}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
  }

  function renderGroup(group: RenderGroup): string {
    return `<div class="category-group">
      <h1 class="category-title">${esc(group.title)}</h1>
      ${group.tables.map((table) => renderTable(table)).join('')}
    </div>`
  }

  const heroHtml = heroImage
    ? `<div class="hero" style="background-image:url('${heroImage}');"></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
@page { size: A4 landscape; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  color: #4a4a4a;
  padding: 24px 30px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.hero {
  width:100%; height:150px;
  background-size:cover; background-position:center;
  border-radius:4px; margin-bottom:20px; overflow:hidden;
}

/* ── Category and line titles ─────────── */
.category-group { margin-bottom:32px; }
.category-title {
  margin-bottom:12px;
  font-size:24px; font-weight:700; color:#3c3c3c;
  letter-spacing:-0.4px;
}
.section { margin-bottom:24px; }
.line-title {
  display:flex; align-items:center; justify-content:center; gap:24px;
  min-height:28px; margin-bottom:6px;
  position:relative; text-align:center;
}
.line-title h2 {
  font-size:16px; font-weight:700; color:#3c3c3c;
  letter-spacing:-0.2px;
}
.pill {
  padding:5px 22px;
  border:1px solid #14a9e0;
  border-radius:999px;
  font-size:10px; font-weight:700;
  color:#14a9e0; background:#fff;
  white-space:nowrap;
}
.line-title .pill { position:absolute; right:0; }

/* ── Table ─────────────────────────────── */
table {
  width:100%;
  border-collapse:separate;
  border-spacing:0;
  font-size:10px;
  color:#4a4a4a;
}

/* ── Header row 1: fixed cols (rowspan=2) + AR group ─ */
.hdr1 th {
  font-weight:700;
  color:#3f3f3f;
  text-transform:uppercase;
  padding:0 10px;
  text-align:center;
  vertical-align:bottom;
  padding-bottom:14px;
  font-size:10px;
  white-space:nowrap;
  height:52px;
  border-bottom:2px solid #20aee4;
  background:#fff;
}
.hdr1 th.hl { text-align:left; }

/* AR group top header — azul arredondado */
.hdr1 th.ar-top {
  background:#16a9dc;
  color:#fff;
  font-size:12px;
  font-weight:700;
  text-align:center;
  vertical-align:middle;
  padding:0 12px;
  height:34px;
  border-bottom:none;
  border-radius:24px 24px 0 0;
  letter-spacing:0.3px;
}

/* ── Header row 2: treatment sub-headers (cinza escuro) ─ */
.hdr2 th.ar-sub {
  background:#3b3b3b;
  color:#fff;
  font-size:10px;
  font-weight:700;
  text-align:center;
  padding:0 6px;
  height:38px;
  vertical-align:middle;
  white-space:nowrap;
  border-bottom:none;
}

/* ── Body rows ─────────────────────────── */
tbody td {
  padding:0 10px;
  height:27px;
  vertical-align:middle;
  font-size:10px;
  white-space:nowrap;
}

/* Zebra — atravessa TODAS as 11 colunas */
.ze td { background:#e9e9e9; }
.zo td { background:#ffffff; }

/* Cantos arredondados nas linhas zebra */
.ze td:first-child { border-radius:6px 0 0 6px; }
.ze td:last-child  { border-radius:0 6px 6px 0; }

/* Column specifics */
td.cc { font-weight:800; color:#3c3c3c; text-align:left; }
td.cm { text-align:left; overflow:hidden; text-overflow:ellipsis; max-width:300px; }
td.cs { text-align:left; }
td.cy { text-align:center; }
td.cd { text-align:center; }
td.ca { text-align:left; }
td.cn { text-align:center; color:#6b6b6b; }
td.cp { text-align:center; }

/* ── Print ─────────────────────────────── */
thead { display:table-header-group; }
tr { page-break-inside:avoid; }
.section { page-break-inside:auto; }
.category-title, .line-title { break-after:avoid; page-break-after:avoid; }
</style>
</head>
<body>
${heroHtml}
${groups.map((group) => renderGroup(group)).join('')}
</body></html>`
}

export async function generatePdf(
  products: ProductWithRelations[],
  catalogMeta?: CatalogExportMeta | CatalogExportMeta[],
  headerImageUrl?: string | null,
): Promise<Buffer> {
  const html = buildPdfHtml(products, catalogMeta, headerImageUrl)
  const chromeRuntimeDir = process.env.CHROME_RUNTIME_DIR ?? path.join('/tmp', `unilentes-chrome-${process.env.USER ?? 'app'}`)
  const chromeHomeDir = path.join(chromeRuntimeDir, 'home')
  const chromeUserDataDir = path.join(chromeRuntimeDir, 'profile')
  const chromeCrashDumpsDir = path.join(chromeRuntimeDir, 'crashpad')
  const chromeCacheDir = path.join(chromeRuntimeDir, 'cache')
  const chromeConfigDir = path.join(chromeRuntimeDir, 'config')
  const chromeTmpDir = path.join(chromeRuntimeDir, 'tmp')

  for (const dir of [
    chromeHomeDir,
    chromeUserDataDir,
    chromeCrashDumpsDir,
    chromeCacheDir,
    chromeConfigDir,
    chromeTmpDir,
  ]) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const puppeteer = await loadPuppeteer()
  const browser = await puppeteer.launch({
    headless: true,
    env: {
      ...process.env,
      HOME: chromeHomeDir,
      XDG_CACHE_HOME: chromeCacheDir,
      XDG_CONFIG_HOME: chromeConfigDir,
      TMPDIR: chromeTmpDir,
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-crash-reporter',
      '--disable-crashpad',
      '--disable-breakpad',
      '--disable-extensions',
      '--no-first-run',
      '--no-default-browser-check',
      '--noerrdialogs',
      `--user-data-dir=${chromeUserDataDir}`,
      `--crash-dumps-dir=${chromeCrashDumpsDir}`,
    ],
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
