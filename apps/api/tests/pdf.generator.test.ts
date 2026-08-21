import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildPdfHtml,
  generatePdf,
} from '../src/modules/exports/pdf.generator'
import { mockCatalogMeta, mockProducts } from './mocks/pdf-export.mock'

test('gera PDF agrupado por marca/categoria e tabelas por linha', async (context) => {
  const html = buildPdfHtml(mockProducts, mockCatalogMeta)

  assert.match(html, /<h1 class="category-title">ZEISS — Multifocais<\/h1>/)
  assert.match(html, /<h2>Progressive GT2 NE Freeform Blueguard<\/h2>/)
  assert.match(html, /<h2>Classic Plus Freeform Blueguard<\/h2>/)
  assert.match(html, /justify-content:center/)
  assert.equal(html.match(/<table>/g)?.length, 2)
  assert.ok(html.indexOf('Progressive GT2 NE Freeform Blueguard') < html.indexOf('Classic Plus Freeform Blueguard'))

  const pdf = await generatePdf(mockProducts, mockCatalogMeta)
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.ok(pdf.byteLength > 20_000)

  const outputPath = process.env.PDF_TEST_OUTPUT
    ?? path.join(tmpdir(), 'unilentes-export-layout-test.pdf')
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, pdf)
  context.diagnostic(`PDF salvo em: ${outputPath}`)
})
