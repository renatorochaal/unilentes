import {
  generatePdf,
  type CatalogExportMeta,
} from '../../src/modules/exports/pdf.generator'

const BRAND_ID = 'brand-zeiss'
const CATEGORY_ID = 'category-multifocais'

function mockTreatments(basePrice: number) {
  return [
    { treatment: { name: 'DV CHROME' }, price: basePrice + 160 },
    { treatment: { name: 'DV GOLD UV' }, price: basePrice + 516 },
    { treatment: { name: 'DV PLATINUM' }, price: basePrice + 460 },
    { treatment: { name: 'DV SILVER' }, price: basePrice + 340 },
  ]
}

const productDefinitions = [
  ['50084', 'ZEISS Progressive GT2 NE Freeform Blueguard 1.5', '-10,00 a +6,00', '72', 868],
  ['50085', 'ZEISS Progressive GT2 NE Freeform Blueguard Poli', '-10,00 a +6,00', '72', 1012],
  ['50086', 'ZEISS Progressive GT2 NE Freeform Blueguard 1.60', '-12,00 a -7,50 a -7,25 a +6,00', '74 / 76', null],
  ['50087', 'ZEISS Progressive GT2 NE Freeform Blueguard 1.67', '-12,00 a -7,50 a -7,25 a +6,00', '74 / 76', null],
  ['5179', 'ZEISS Classic Plus Freeform Blueguard - 1.50', '-7,00 a +5,00', '75', null],
  ['5180', 'ZEISS Classic Plus Freeform Blueguard 1.60', '-12,00 a -7,50 a -7,25 a +6,00', '74 / 76', null],
  ['5181', 'ZEISS Classic Plus Freeform Blueguard Poli', '-7,00 a +5,00', '75', null],
  ['5182', 'ZEISS Classic Plus Freeform Blueguard 1.67', '-12,00 a -7,50 a -7,25 a +6,00', '74 / 76', null],
] as const

export const mockProducts = productDefinitions.map(
  ([code, name, spherical, diameter, priceNoAR], index) => ({
    id: `product-${code}`,
    code,
    name,
    spherical,
    cylindrical: '-6,00',
    diameter,
    addition: '1,00 a 3,00',
    priceNoAR,
    brand: { id: BRAND_ID, name: 'ZEISS' },
    category: { id: CATEGORY_ID, name: 'Multifocais' },
    treatments: mockTreatments(868 + index * 120),
  }),
) as unknown as Parameters<typeof generatePdf>[0]

export const mockCatalogMeta: CatalogExportMeta = {
  title: 'LENTE ZEISS MULTIFOCAIS',
  badge: 'ALTURAS 14 A 18',
  brandId: BRAND_ID,
  brandName: 'ZEISS',
  categoryId: CATEGORY_ID,
  categoryName: 'Multifocais',
  sections: [
    {
      id: 'progressive-gt2',
      title: 'Progressive GT2 NE Freeform Blueguard',
      productIds: mockProducts.slice(0, 4).map(({ id }) => id),
    },
    {
      id: 'classic-plus',
      title: 'Classic Plus Freeform Blueguard',
      productIds: mockProducts.slice(4).map(({ id }) => id),
    },
  ],
}
