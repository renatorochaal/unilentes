import PDFDocument from 'pdfkit'
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
  return `R$ ${Number(val).toFixed(2).replace('.', ',')}`
}

export async function generatePdf(products: ProductWithRelations[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 24,
      info: { Title: 'Catálogo Unilentes', Author: 'Unilentes' },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ── Paleta ──────────────────────────────────────────────────
    const PRIMARY   = '#54A7D9'
    const DARK      = '#1a3a52'
    const GRAY_BG   = '#F5F7FA'
    const GRAY_LINE = '#E0E4E8'
    const TEXT_DIM  = '#6B7280'
    const WHITE     = '#FFFFFF'

    const PAGE_W  = doc.page.width
    const MARGIN  = 24
    const CONTENT_W = PAGE_W - MARGIN * 2

    // ── Header da página ─────────────────────────────────────────
    function drawPageHeader() {
      // Barra azul topo
      doc.rect(0, 0, PAGE_W, 50).fill(DARK)
      doc.fillColor(WHITE).fontSize(18).font('Helvetica-Bold')
        .text('UNILENTES', MARGIN, 14, { lineBreak: false })
      doc.fillColor(PRIMARY).fontSize(10).font('Helvetica')
        .text('Catálogo de Lentes', MARGIN, 34, { lineBreak: false })

      // Data geração
      const dateStr = new Date().toLocaleString('pt-BR')
      doc.fillColor(GRAY_LINE).fontSize(8).font('Helvetica')
        .text(`Gerado em ${dateStr}`, 0, 34, { align: 'right', width: PAGE_W - MARGIN, lineBreak: false })

      doc.moveDown(0.5)
    }

    // ── Agrupar por marca + categoria ─────────────────────────────
    const groups = new Map<string, { brand: string; category: string; items: typeof products }>()
    for (const p of products) {
      const key = `${p.brand.name}||${p.category.name}`
      if (!groups.has(key)) {
        groups.set(key, { brand: p.brand.name, category: p.category.name, items: [] })
      }
      groups.get(key)!.items.push(p)
    }

    const treatmentNames = Array.from(
      new Set(products.flatMap((p) => p.treatments.map((t) => t.treatment.name)))
    ).sort()

    // ── Larguras de colunas ───────────────────────────────────────
    const COL_CODE  = 48
    const COL_NAME  = 120
    const COL_SPH   = 110
    const COL_CYL   = 45
    const COL_DIAM  = 38
    const COL_ADD   = 90
    const COL_NOAR  = 55
    const fixedWidth = COL_CODE + COL_NAME + COL_SPH + COL_CYL + COL_DIAM + COL_ADD + COL_NOAR
    const arWidth   = Math.max(50, Math.floor((CONTENT_W - fixedWidth) / Math.max(treatmentNames.length, 1)))

    const ROW_H  = 18
    const HEAD_H = 14

    function drawTableHeader(y: number): number {
      // Faixa AR agrupada
      if (treatmentNames.length > 0) {
        const arStart = MARGIN + fixedWidth
        const arTotalW = arWidth * treatmentNames.length
        doc.rect(arStart, y, arTotalW, HEAD_H).fill(PRIMARY)
        doc.fillColor(WHITE).fontSize(7).font('Helvetica-Bold')
          .text('COM ANTIRREFLEXO (AR)', arStart, y + 4, { width: arTotalW, align: 'center', lineBreak: false })
        y += HEAD_H
      }

      // Cabeçalhos de coluna
      doc.rect(MARGIN, y, CONTENT_W, HEAD_H).fill(GRAY_BG)
      doc.fillColor(TEXT_DIM).fontSize(7).font('Helvetica-Bold')

      const cols = [
        { label: 'CÓD.',    w: COL_CODE,  align: 'left'  as const },
        { label: 'MATERIAL', w: COL_NAME,  align: 'left'  as const },
        { label: 'ESFÉRICO', w: COL_SPH,   align: 'left'  as const },
        { label: 'CIL',      w: COL_CYL,   align: 'center' as const },
        { label: 'Ø',        w: COL_DIAM,  align: 'center' as const },
        { label: 'ADIÇÃO',   w: COL_ADD,   align: 'left'  as const },
        { label: 'SEM AR',   w: COL_NOAR,  align: 'right'  as const },
        ...treatmentNames.map((tn) => ({ label: tn.toUpperCase(), w: arWidth, align: 'right' as const })),
      ]

      let x = MARGIN
      for (const col of cols) {
        doc.text(col.label, x + 2, y + 4, { width: col.w - 4, align: col.align, lineBreak: false })
        x += col.w
      }

      // Linha separadora
      doc.moveTo(MARGIN, y + HEAD_H).lineTo(MARGIN + CONTENT_W, y + HEAD_H).strokeColor(GRAY_LINE).lineWidth(0.5).stroke()

      return y + HEAD_H
    }

    function drawRow(p: typeof products[0], y: number, even: boolean): number {
      if (even) doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill('#F9FAFB')
      doc.fillColor('#374151').fontSize(8).font('Helvetica')

      const priceMap = Object.fromEntries(p.treatments.map((t) => [t.treatment.name, t.price]))

      const values = [
        { val: p.code,             w: COL_CODE,  align: 'left'   as const },
        { val: p.name,             w: COL_NAME,  align: 'left'   as const },
        { val: p.spherical ?? '-', w: COL_SPH,   align: 'left'   as const },
        { val: p.cylindrical ?? '-', w: COL_CYL, align: 'center' as const },
        { val: p.diameter ?? '-',  w: COL_DIAM,  align: 'center' as const },
        { val: p.addition ?? '-',  w: COL_ADD,   align: 'left'   as const },
        { val: formatPrice(p.priceNoAR), w: COL_NOAR, align: 'right' as const },
        ...treatmentNames.map((tn) => ({
          val: priceMap[tn] != null ? formatPrice(priceMap[tn]) : '-',
          w: arWidth,
          align: 'right' as const,
        })),
      ]

      let x = MARGIN
      for (const col of values) {
        doc.text(col.val, x + 2, y + 5, { width: col.w - 4, align: col.align, lineBreak: false, ellipsis: true })
        x += col.w
      }

      doc.moveTo(MARGIN, y + ROW_H).lineTo(MARGIN + CONTENT_W, y + ROW_H).strokeColor(GRAY_LINE).lineWidth(0.3).stroke()
      return y + ROW_H
    }

    // ── Renderização ─────────────────────────────────────────────
    let firstPage = true

    for (const group of groups.values()) {
      if (!firstPage) {
        doc.addPage()
      }
      firstPage = false

      drawPageHeader()
      let y = 60

      // Título do grupo
      doc.rect(MARGIN, y, CONTENT_W, 22).fill(PRIMARY)
      doc.fillColor(WHITE).fontSize(11).font('Helvetica-Bold')
        .text(`${group.brand}  —  ${group.category}`, MARGIN + 8, y + 6, { lineBreak: false })
      y += 22 + 6

      // Cabeçalho da tabela
      y = drawTableHeader(y)

      // Linhas de produto
      let even = false
      for (const p of group.items) {
        // Verificar espaço na página
        if (y + ROW_H > doc.page.height - 30) {
          doc.addPage()
          drawPageHeader()
          y = 60
          y = drawTableHeader(y)
        }
        y = drawRow(p, y, even)
        even = !even
      }
    }

    // Footer em todas as páginas
    const range = doc.bufferedPageRange()
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i)
      doc.fillColor(TEXT_DIM).fontSize(8).font('Helvetica')
        .text(
          `Página ${i + 1} de ${range.count}  |  Unilentes — Sistema de Gerenciamento`,
          MARGIN,
          doc.page.height - 20,
          { align: 'center', width: CONTENT_W, lineBreak: false }
        )
    }

    doc.end()
  })
}
