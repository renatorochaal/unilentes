import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { parseWorkbook } from '../src/modules/products/product.spreadsheet'

function workbook(sheets: Record<string, unknown[][]>, bookType: XLSX.BookType = 'xlsx'): Buffer {
  const book = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name)
  }
  return XLSX.write(book, { type: 'buffer', bookType }) as Buffer
}

const MAX_HD = [
  ['LENTES MAX HD'],
  ['VALORES DE ANTIRREFLEXO', null, null, null, null, null, null, null, 'UNILENS', 'UNILENS EXTRA'],
  [null, null, null, null, null, null, null, null, 131, 225],
  ['Altura de montagem: 13 a 35 mm'],
  ['Código WEB', 'Cód. Anterior', 'Material', 'Disponibilidade', 'Cil', 'Ø', 'Adição', 'Sem AR', 'Antirreflexo (AR)', null, 'Guelta'],
  [null, null, null, null, null, null, null, null, 'UNILENS', 'unilens  extra', 'Guelta'],
  [50768, null, '1.49 Inc', '-6,00 a +5,50', -4, '60 a 76', '0,75 a 4,00', 673, 804, '-', 130],
  ['SOMA', null, null, null, null, null, null, 9000, 9000, 9000],
  ['51000', null, 'Poli', '-9,00 a +6,00', '-5,00', 75, '1,00 a 3,00', '-', 900, 1000],
]

test('localiza colunas pelo cabeçalho e ignora linhas que não são produto', () => {
  const [sheet] = parseWorkbook(workbook({ Capa: [['Tabela']], 'Max HD': MAX_HD }), [])

  assert.equal(sheet.name, 'Max HD')
  assert.deepEqual(sheet.products.map((p) => p.code), ['50768', '51000'])
  assert.deepEqual(sheet.treatments, ['Unilens', 'Unilens Extra'])

  const [first, second] = sheet.products
  assert.equal(first.name, '1.49 Inc')
  assert.equal(first.spherical, '-6,00 a +5,50')
  assert.equal(first.cylindrical, '-4,00')
  assert.equal(first.height, '13 a 35')
  assert.equal(first.priceNoAR, 673)
  assert.deepEqual(first.prices, [
    { treatment: 'Unilens', price: 804 },
    { treatment: 'Unilens Extra', price: null },
  ])
  assert.equal(second.priceNoAR, null)
})

test('lê .xlsb e .xlsx do mesmo jeito', () => {
  const fromXlsb = parseWorkbook(workbook({ 'Max HD': MAX_HD }, 'xlsb'), [])
  const fromXlsx = parseWorkbook(workbook({ 'Max HD': MAX_HD }, 'xlsx'), [])
  assert.deepEqual(fromXlsb, fromXlsx)
})

test('usa o "Sem AR" do sub-cabeçalho e o layout de cada bloco', () => {
  const [sheet] = parseWorkbook(workbook({
    Essilor: [
      ['Código WEB', 'Material', 'Disponibilidade', 'Cilindrico até', null, null, 'Sem AR', 'Antirreflexo(AR)'],
      ['Lentes', null, null, null, 'Sem AR', null, null, 'Optifog', 'Crizal Sapphire', 'Vernz HC'],
      [1001, 'A', '-1,00', '-6', 500, null, '-', 700, 800, 900],
      ['Outro bloco', null, null, null, 'Sem AR', null, 'Natural Look', 'Optifog'],
      [1002, 'B', '-2,00', '-6', 600, null, 950, 750],
    ],
  }), [])

  const [a, b] = sheet.products
  assert.equal(a.priceNoAR, 500)
  assert.deepEqual(a.prices.map((p) => p.treatment), ['Optifog', 'Crizal Sapphire', 'Verniz HC'])
  assert.deepEqual(b.prices, [
    { treatment: 'Natural Look', price: 950 },
    { treatment: 'Optifog', price: 750 },
  ])
})

test('coluna desconhecida não vira tratamento e fica registrada', () => {
  const header = ['Código WEB', 'Material', 'Disponibilidade', 'Sem AR']
  const rows = [header, [null, null, null, null, 'Optifog', 'Verniz HC', 'SURF', 'Coluna9'], [2001, 'A', '-1,00', 100, 200, 300, 400, 500]]

  const [unknown] = parseWorkbook(workbook({ Aba: rows }), [])
  assert.deepEqual(unknown.treatments, ['Optifog', 'Verniz HC'])
  assert.deepEqual(unknown.ignoredColumns, [{ name: 'SURF', prices: 1 }])

  const [known] = parseWorkbook(workbook({ Aba: rows }), ['Surf'])
  assert.deepEqual(known.treatments, ['Optifog', 'Verniz HC', 'Surf'])
  assert.deepEqual(known.ignoredColumns, [])
})

test('apelido e nome direto resolvem para a mesma grafia do cadastro', () => {
  const [sheet] = parseWorkbook(workbook({
    Zeiss: [
      ['Código WEB', 'Material', 'Sem AR'],
      [null, null, null, 'DV Chrome', 'DV Gold'],
      [4001, 'A', 100, 200, 300],
      [null, null, null, 'DV Chrome', 'DV Gold UV'],
      [4002, 'B', 100, 200, 300],
    ],
  }), ['DV GOLD UV'])

  assert.deepEqual(sheet.treatments, ['DV Chrome', 'DV GOLD UV'])
})

test('código repetido fica com a primeira aba selecionada', () => {
  const sheetRows = (name: string, price: number) => [
    ['Código WEB', 'Material', 'Sem AR'],
    [null, null, null, 'Optifog', 'Verniz HC'],
    [3001, name, price, 1, 2],
  ]
  const buf = workbook({ A: sheetRows('da A', 10), B: sheetRows('da B', 20) })

  const all = parseWorkbook(buf, [])
  assert.deepEqual(all.map((s) => s.name), ['A'])

  const onlyB = parseWorkbook(buf, [], ['B'])
  assert.equal(onlyB[0].products[0].name, 'da B')
})

test('código repetido com preço diferente é apontado como conflito', () => {
  const rows = (price: number) => [
    ['Código WEB', 'Material', 'Sem AR'],
    [null, null, null, 'Optifog', 'Verniz HC'],
    [3001, 'Lente', price, 1, 2],
  ]
  const [, conflict] = parseWorkbook(workbook({ A: rows(10), B: [...rows(20), [3002, 'Outra', 5, 1, 2]] }), [])
  assert.deepEqual(conflict.duplicates, ['3001'])
  assert.deepEqual(conflict.conflicts, [{ code: '3001', keptFrom: 'A' }])

  const [, same] = parseWorkbook(workbook({ A: rows(10), B: [...rows(10), [3002, 'Outra', 5, 1, 2]] }), [])
  assert.deepEqual(same.duplicates, ['3001'])
  assert.deepEqual(same.conflicts, [])
})
