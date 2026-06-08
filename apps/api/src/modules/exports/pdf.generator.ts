import { Prisma } from '@prisma/client'
import path from 'path'
import fs from 'fs'

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    brand:    { select: { name: true } }
    category: { select: { name: true } }
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
  badge?: string | null
  sections?: CatalogSection[] | null
  headerImage?: string | null
  brandName?: string | null
  brandLogoUrl?: string | null
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

function buildHtml(
  products: ProductWithRelations[],
  catalogMeta?: CatalogExportMeta,
  headerImageUrl?: string | null,
): string {
  const effectiveImageUrl = headerImageUrl ?? catalogMeta?.headerImage ?? null
  const heroImage = resolveImageToBase64(effectiveImageUrl)

  const treatmentNames = Array.from(
    new Set(products.flatMap((p) => p.treatments.map((t) => t.treatment.name)))
  ).sort()
  const hasTreatments = treatmentNames.length > 0
  const arCount = treatmentNames.length

  interface RenderGroup { title: string; badge?: string | null; items: ProductWithRelations[] }
  const groups: RenderGroup[] = []

  if (catalogMeta?.sections?.length) {
    const pm = new Map(products.map((p) => [p.id, p]))
    for (const s of catalogMeta.sections) {
      const items = s.productIds.map((id) => pm.get(id)).filter((p): p is ProductWithRelations => !!p)
      if (items.length) groups.push({ title: s.title || catalogMeta.title, badge: catalogMeta.badge, items })
    }
  } else if (catalogMeta?.title) {
    groups.push({ title: catalogMeta.title, badge: catalogMeta.badge, items: products })
  } else {
    const map = new Map<string, { brand: string; cat: string; items: ProductWithRelations[] }>()
    for (const p of products) {
      const k = `${p.brand.name}||${p.category.name}`
      if (!map.has(k)) map.set(k, { brand: p.brand.name, cat: p.category.name, items: [] })
      map.get(k)!.items.push(p)
    }
    for (const g of map.values()) groups.push({ title: `${g.brand} — ${g.cat}`, items: g.items })
  }

  function renderSection(g: RenderGroup): string {
    const rows = g.items.map((p, i) => {
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
      <div class="stitle">
        <h2>${esc(g.title)}</h2>
        ${g.badge ? `<span class="pill">${esc(g.badge.toUpperCase())}</span>` : ''}
      </div>
      <table>
        <thead>${theadHtml}</thead>
        <tbody>${rows}</tbody>
      </table>
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

/* ── Section title ────────────────────── */
.section { margin-bottom:28px; }
.stitle {
  display:flex; align-items:center; gap:24px;
  margin-bottom:6px;
}
.stitle h2 {
  font-size:24px; font-weight:700; color:#3c3c3c;
  letter-spacing:-0.4px;
}
.pill {
  padding:5px 22px;
  border:1px solid #14a9e0;
  border-radius:999px;
  font-size:10px; font-weight:700;
  color:#14a9e0; background:#fff;
  white-space:nowrap;
}

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
</style>
</head>
<body>
${heroHtml}
${groups.map(g => renderSection(g)).join('')}
</body></html>`
}

export async function generatePdf(
  products: ProductWithRelations[],
  catalogMeta?: CatalogExportMeta,
  headerImageUrl?: string | null,
): Promise<Buffer> {
  const html = buildHtml(products, catalogMeta, headerImageUrl)
  const puppeteer = await loadPuppeteer()
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
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
