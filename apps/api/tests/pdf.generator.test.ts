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

test('colunas de tratamento são definidas por categoria, não pela união do export', () => {
  const otherCategory = {
    id: 'category-maxhd',
    name: 'Max HD',
    treatments: [
      { treatment: { id: 't-ue', name: 'UNILENS EXTRA' } },
      { treatment: { id: 't-up', name: 'UNILENS PROTECTION' } },
    ],
  }
  const maxHdProduct = {
    ...mockProducts[0],
    id: 'product-50768',
    code: '50768',
    category: otherCategory,
    treatments: [
      { treatment: { name: 'UNILENS PROTECTION' }, price: 946 },
      { treatment: { name: 'UNILENS EXTRA' }, price: 898 },
      // Fora da configuração da categoria: não deve virar coluna
      { treatment: { name: 'DV CHROME' }, price: 900 },
    ],
  } as unknown as (typeof mockProducts)[number]

  const html = buildPdfHtml([...mockProducts, maxHdProduct])
  const tables = html.split('<table>').slice(1)
  assert.equal(tables.length, 2)

  // Zeiss (sem configuração): só os tratamentos com preço nos seus produtos
  assert.match(tables[0], /DV CHROME/)
  assert.doesNotMatch(tables[0], /UNILENS/)

  // Max HD (configurada): exatamente as colunas configuradas, na ordem definida
  const maxHdHeaders = [...tables[1].matchAll(/<th class="ar-sub">([^<]+)<\/th>/g)].map((m) => m[1])
  assert.deepEqual(maxHdHeaders, ['UNILENS EXTRA', 'UNILENS PROTECTION'])
})

test('páginas de imagem respeitam a posição e bloqueiam path traversal', () => {
  const html = buildPdfHtml(mockProducts, mockCatalogMeta, null, null, [
    { imageUrl: 'https://example.com/capa.png', position: 'start' },
    { imageUrl: 'https://example.com/zeiss.png', position: 'beforeBrand', brandId: 'brand-zeiss' },
    { imageUrl: 'https://example.com/fim.png', position: 'end' },
    { imageUrl: 'https://example.com/outra.png', position: 'beforeBrand', brandId: 'brand-inexistente' },
    { imageUrl: '/uploads/../.env', position: 'end' },
  ])

  const capa  = html.indexOf('capa.png')
  const zeiss = html.indexOf('zeiss.png')
  const title = html.indexOf('<h1 class="category-title">')
  const fim   = html.indexOf('fim.png')
  assert.ok(capa > -1 && capa < zeiss && zeiss < title && title < fim)
  assert.equal(html.match(/class="image-page"/g)?.length, 3)
  assert.doesNotMatch(html, /outra\.png/)
  // Começa com página de imagem: sem o espaçador do topo
  assert.doesNotMatch(html, /class="doc-top"/)
})
