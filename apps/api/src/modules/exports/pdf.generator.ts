import { Prisma } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { resolveTreatmentColumns } from '../categories/category-treatments'

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    brand:    { select: { id: true; name: true } }
    category: {
      select: {
        id: true
        name: true
        treatments: { include: { treatment: { select: { id: true; name: true } } } }
      }
    }
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

export type PdfImagePagePosition = 'start' | 'end' | 'beforeBrand' | 'afterBrand'

/** Página inteira (A4) com uma imagem, inserida numa posição do PDF. */
export interface PdfImagePage {
  imageUrl: string
  position: PdfImagePagePosition
  /** Obrigatório quando position é beforeBrand/afterBrand. */
  brandId?: string | null
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

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
}

function resolveImageToBase64(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    if (url.startsWith('/uploads/')) {
      const uploadsDir = path.resolve('./uploads')
      const localPath = path.resolve(uploadsDir, url.replace(/^\/uploads\//, ''))
      // A URL vem do cliente: bloqueia path traversal (/uploads/../.env) e
      // qualquer arquivo que não seja imagem conhecida.
      if (!localPath.startsWith(uploadsDir + path.sep)) return null
      const mime = IMAGE_MIME_BY_EXT[path.extname(localPath).slice(1).toLowerCase()]
      if (mime && fs.existsSync(localPath)) {
        return `data:${mime};base64,${fs.readFileSync(localPath).toString('base64')}`
      }
    }
    if (url.startsWith('http')) return url
  } catch { /* ignore */ }
  return null
}

function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}


async function loadPuppeteer() {
  const mod = await Function('return import("puppeteer")')() as typeof import('puppeteer')
  return mod.default ?? mod
}

export function buildPdfHtml(
  products: ProductWithRelations[],
  catalogMeta?: CatalogExportMeta | CatalogExportMeta[],
  headerImageUrl?: string | null,
  brandImages?: Record<string, string> | null,
  imagePages?: PdfImagePage[] | null,
): string {
  const isMultiCatalog = Array.isArray(catalogMeta)
  const catalogMetas = catalogMeta
    ? (isMultiCatalog ? catalogMeta : [catalogMeta])
    : []
  const effectiveImageUrl = headerImageUrl
    ?? (!Array.isArray(catalogMeta) ? catalogMeta?.headerImage : null)
    ?? null
  const heroImage = resolveImageToBase64(effectiveImageUrl)

  // Larguras de coluna calculadas para caber na área útil do A4 retrato
  // (595pt ≈ 734px de largura útil, descontando padding do body). Colunas
  // numéricas foram enxugadas para sobrar mais espaço pra MATERIAL, que é
  // a que mais varia de tamanho (nomes longos de lente).
  const COL_CODE = 50, COL_ESF = 76, COL_CIL = 38, COL_DIAM = 36, COL_ADD = 60, COL_NOAR = 56
  const PORTRAIT_CONTENT_W = 734
  const MIN_MATERIAL_W = 110
  const fixedColsSum = COL_CODE + COL_ESF + COL_CIL + COL_DIAM + COL_ADD + COL_NOAR
  const arBudget = Math.max(0, PORTRAIT_CONTENT_W - fixedColsSum - MIN_MATERIAL_W)

  // As colunas de tratamento são definidas por categoria (cada grupo), então
  // a largura também é calculada por grupo.
  function buildColgroup(treatmentNames: string[]): string {
    const arCount = treatmentNames.length
    const hasTreatments = arCount > 0
    const arColWidth = hasTreatments ? Math.max(46, Math.floor(arBudget / arCount)) : 0
    const materialColWidth = Math.max(MIN_MATERIAL_W, PORTRAIT_CONTENT_W - fixedColsSum - arColWidth * arCount)
    const arCols = hasTreatments
      ? Array.from({ length: arCount }, () => `<col style="width:${arColWidth}px">`).join('')
      : ''
    return `<colgroup>
      <col style="width:${COL_CODE}px">
      <col style="width:${materialColWidth}px">
      <col style="width:${COL_ESF}px">
      <col style="width:${COL_CIL}px">
      <col style="width:${COL_DIAM}px">
      <col style="width:${COL_ADD}px">
      <col style="width:${COL_NOAR}px">
      ${arCols}
    </colgroup>`
  }

  interface RenderTable {
    title?: string | null
    badge?: string | null
    items: ProductWithRelations[]
  }
  interface RenderGroup {
    brandId: string
    title: string
    tables: RenderTable[]
    treatmentNames: string[]
    bannerImage?: string | null
  }
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

  const brandBannerShown = new Set<string>()
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

    const isFirstForBrand = !brandBannerShown.has(productGroup.brandId)
    if (isFirstForBrand) brandBannerShown.add(productGroup.brandId)
    const brandOverrideImage = isFirstForBrand ? brandImages?.[productGroup.brandId] : null
    const catalogBannerImage = isMultiCatalog ? meta?.headerImage : null

    groups.push({
      brandId: productGroup.brandId,
      title: `${productGroup.brandName} — ${productGroup.categoryName}`,
      tables,
      treatmentNames: resolveTreatmentColumns(productGroup.items[0]?.category.treatments, productGroup.items),
      bannerImage: resolveImageToBase64(brandOverrideImage ?? catalogBannerImage),
    })
  }

  function renderTable(table: RenderTable, treatmentNames: string[]): string {
    const hasTreatments = treatmentNames.length > 0
    const arCount = treatmentNames.length
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
          <th rowspan="2" class="hl wrap">Cod. WEB</th>
          <th rowspan="2" class="hl wrap">MATERIAL</th>
          <th rowspan="2" class="hl wrap">ESFÉRICO</th>
          <th rowspan="2">CIL</th>
          <th rowspan="2">Ø</th>
          <th rowspan="2" class="hl">ADIÇÃO</th>
          <th rowspan="2">SEM AR</th>
          <th colspan="${arCount}" class="ar-top">COM ANTIRREFLEXO (AR)</th>
        </tr>
        <tr class="hdr2">
          ${treatmentNames.map(tn => `<th class="ar-sub">${esc(tn.toUpperCase())}</th>`).join('')}
        </tr>`
      : `<tr class="hdr1">
          <th class="hl wrap">Cod. WEB</th>
          <th class="hl wrap">MATERIAL</th>
          <th class="hl wrap">ESFÉRICO</th>
          <th>CIL</th>
          <th>Ø</th>
          <th class="hl">ADIÇÃO</th>
          <th>SEM AR</th>
        </tr>`

    return `
    <div class="section">
      ${table.title || table.badge ? `<div class="line-title">
        ${table.title ? `<h2>${esc(table.title)}</h2>` : ''}
        ${table.badge ? `<span class="pill">${esc(table.badge.toUpperCase())}</span>` : ''}
      </div>` : ''}
      <table>
        ${buildColgroup(treatmentNames)}
        <thead>${theadHtml}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
  }

  function renderGroup(group: RenderGroup): string {
    const bannerHtml = group.bannerImage
      ? `<div class="group-banner" style="background-image:url('${group.bannerImage}');"></div>`
      : ''
    return `<div class="category-group">
      ${bannerHtml}
      <h1 class="category-title">${esc(group.title)}</h1>
      ${group.tables.map((table) => renderTable(table, group.treatmentNames)).join('')}
    </div>`
  }

  const heroHtml = heroImage
    ? `<div class="hero" style="background-image:url('${heroImage}');"></div>`
    : ''

  function renderImagePages(pages: PdfImagePage[]): string {
    return pages
      .map((page) => resolveImageToBase64(page.imageUrl))
      .filter((src): src is string => !!src)
      .map((src) => `<div class="image-page"><img src="${escAttr(src)}" alt=""></div>`)
      .join('')
  }
  const pagesAt = (position: PdfImagePagePosition, brandId?: string) =>
    renderImagePages((imagePages ?? []).filter((page) =>
      page.position === position && (brandId === undefined || page.brandId === brandId)))

  // Monta o corpo respeitando as posições das páginas de imagem: antes do
  // primeiro grupo e depois do último grupo de cada marca.
  const bodyParts: string[] = [pagesAt('start'), heroHtml]
  groups.forEach((group, i) => {
    const isFirstOfBrand = groups[i - 1]?.brandId !== group.brandId
    const isLastOfBrand  = groups[i + 1]?.brandId !== group.brandId
    if (isFirstOfBrand) bodyParts.push(pagesAt('beforeBrand', group.brandId))
    bodyParts.push(renderGroup(group))
    if (isLastOfBrand) bodyParts.push(pagesAt('afterBrand', group.brandId))
  })
  bodyParts.push(pagesAt('end'))

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<style>
@page { size: A4 portrait; margin: 0; }
/* Página nomeada: força quebra antes/depois e ocupa a folha inteira */
@page fullbleed { size: A4 portrait; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 10px;
  color: #4a4a4a;
  padding: 0 30px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.doc-top { height:24px; }

.image-page {
  page: fullbleed;
  break-before: page; break-after: page;
  /* anula o padding lateral do body; 296mm evita sobra que gera folha em branco */
  margin: 0 -30px;
  width: 210mm; height: 296mm;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.image-page img { max-width:100%; max-height:100%; object-fit:contain; }
.image-page + .category-group, .image-page + .hero { margin-top:24px; }

.hero {
  width:100%; height:150px;
  background-size:cover; background-position:center;
  border-radius:4px; margin-bottom:20px; overflow:hidden;
}

.group-banner {
  width:100%; height:110px;
  background-size:cover; background-position:center;
  border-radius:4px; margin-bottom:14px; overflow:hidden;
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
  table-layout:fixed;
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
  padding:0 4px;
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
.hdr1 th.wrap { white-space:normal; word-break:normal; overflow-wrap:break-word; }

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
  font-size:9px;
  font-weight:700;
  text-align:center;
  padding:0 4px;
  height:38px;
  vertical-align:middle;
  white-space:normal;
  word-break:normal;
  overflow-wrap:break-word;
  border-bottom:none;
}

/* ── Body rows ─────────────────────────── */
tbody td {
  padding:0 4px;
  min-height:27px;
  vertical-align:middle;
  font-size:10px;
  white-space:normal;
  word-break:normal;
  overflow-wrap:break-word;
}

/* Zebra — atravessa TODAS as 11 colunas */
.ze td { background:#e9e9e9; }
.zo td { background:#ffffff; }

/* Cantos arredondados nas linhas zebra */
.ze td:first-child { border-radius:6px 0 0 6px; }
.ze td:last-child  { border-radius:0 6px 6px 0; }

/* Column specifics */
td.cc { font-weight:800; color:#3c3c3c; text-align:left; }
td.cm { text-align:left; white-space:normal; word-break:normal; overflow-wrap:break-word; }
td.cs { text-align:left; white-space:normal; word-break:normal; overflow-wrap:break-word; }
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
${bodyParts[0] ? '' : '<div class="doc-top"></div>'}
${bodyParts.join('')}
</body></html>`
}

export async function generatePdf(
  products: ProductWithRelations[],
  catalogMeta?: CatalogExportMeta | CatalogExportMeta[],
  headerImageUrl?: string | null,
  brandImages?: Record<string, string> | null,
  imagePages?: PdfImagePage[] | null,
): Promise<Buffer> {
  const html = buildPdfHtml(products, catalogMeta, headerImageUrl, brandImages, imagePages)
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
      landscape: false,
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}
