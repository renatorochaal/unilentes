import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function upsertCategory(name: string, description: string, brandId: string) {
  const existing = await prisma.category.findFirst({ where: { name, brandId } })
  if (existing) {
    return prisma.category.update({ where: { id: existing.id }, data: { description, brandId } })
  }
  return prisma.category.create({ data: { name, description, brandId } })
}

async function main() {
  console.log('🌱 Iniciando seed...')

  // ── Users ─────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@unilentes.com.br' },
    update: {},
    create: { name: 'Administrador', email: 'admin@unilentes.com.br', password: hashedPassword, role: Role.ADMIN },
  })
  const hashedPassword2 = await bcrypt.hash('Admin@123', 10)
  await prisma.user.upsert({
    where: { email: 'admin@unilente.com.br' },
    update: {},
    create: { name: 'Administrador', email: 'admin@unilente.com.br', password: hashedPassword2, role: Role.ADMIN },
  })
  console.log('✅ Usuários criados')

  // ── Brands ────────────────────────────────
  const zeiss = await prisma.brand.upsert({ where: { name: 'ZEISS' }, update: {}, create: { name: 'ZEISS', description: 'Carl Zeiss Vision' } })
  const hoya  = await prisma.brand.upsert({ where: { name: 'HOYA' }, update: {}, create: { name: 'HOYA', description: 'Hoya Vision Care' } })
  console.log('✅ Marcas criadas')

  // ── Categories (brand-specific) ────────────
  // ZEISS categories
  const zeissMulti = await upsertCategory('Multifocais', 'Lentes progressivas e multifocais', zeiss.id)
  const zeissVS = await upsertCategory('Visão Simples', 'Lentes de visão simples', zeiss.id)
  // HOYA categories
  const hoyaMulti = await upsertCategory('Multifocais', 'Lentes progressivas e multifocais', hoya.id)
  const hoyaVS = await upsertCategory('Visão Simples', 'Lentes de visão simples', hoya.id)
  // Alias for backward compat
  const multifocais = zeissMulti
  const visaoSimples = hoyaVS
  console.log('✅ Categorias criadas (brand-specific)')

  // ── Treatments ────────────────────────────
  const [dvChrome, dvSilver, dvPlatinum, dvGoldUv] = await Promise.all([
    prisma.treatment.upsert({ where: { name: 'DV Chrome' }, update: {}, create: { name: 'DV Chrome' } }),
    prisma.treatment.upsert({ where: { name: 'DV Silver' }, update: {}, create: { name: 'DV Silver' } }),
    prisma.treatment.upsert({ where: { name: 'DV Platinum' }, update: {}, create: { name: 'DV Platinum' } }),
    prisma.treatment.upsert({ where: { name: 'DV Gold UV' }, update: {}, create: { name: 'DV Gold UV' } }),
  ])
  console.log('✅ Tratamentos criados')

  // ── Products ──────────────────────────────
  interface ProductSeed {
    code: string; name: string; brandId: string; categoryId: string
    spherical: string; cylindrical: string; diameter: string; addition: string
    height?: string; priceNoAR?: number
    ar: { chrome: number; silver: number; platinum: number; gold: number }
  }

  const products: ProductSeed[] = [
    // ── ZEISS Multifocais (Classic Plus Freeform Blueguard) ──
    { code: '5179', name: '1.50', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-7,00 a +5,00 / -7,00 a 5,00', cylindrical: '-6,00', diameter: '75', addition: '1,00 a 3,50 / 1,00 a 3,00', height: '14 A 18', ar: { chrome: 290, silver: 290, platinum: 290, gold: 290 } },
    { code: '5181', name: 'Poli', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-10,00 a +6,00', cylindrical: '-6,00', diameter: '75', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 410, silver: 410, platinum: 410, gold: 410 } },
    { code: '5180', name: '1.60', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-12,00 a -7,50 / -7,25 a +6,00', cylindrical: '-6,00', diameter: '74 / 76', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 522, silver: 522, platinum: 522, gold: 522 } },
    { code: '5182', name: '1.67', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-12,00 a -7,50 / -7,25 a +6,00', cylindrical: '-6,00', diameter: '74 / 76', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 1042, silver: 1042, platinum: 1042, gold: 1042 } },
    { code: '5183', name: '1.5 Classic Plus PhotoFusion X Cinza', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-10,00 a +6,00', cylindrical: '-6,00', diameter: '72', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 726, silver: 726, platinum: 726, gold: 726 } },
    { code: '5187', name: 'Poli Classic Plus PhotoFusion X Cinza', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-10,00 a +6,00', cylindrical: '-6,00', diameter: '72', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 978, silver: 978, platinum: 978, gold: 978 } },
    { code: '5185', name: '1.60 Classic Plus PhotoFusion X Cinza', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-12,00 a -7,50 / -7,25 a +6,00', cylindrical: '-6,00', diameter: '74 / 76', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 1090, silver: 1090, platinum: 1090, gold: 1090 } },
    { code: '5189', name: '1.67 Classic Plus PhotoFusion X Cinza', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-12,00 a -7,50 / -7,25 a +6,00', cylindrical: '-6,00', diameter: '74 / 76', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 1610, silver: 1610, platinum: 1610, gold: 1610 } },
    { code: '5191', name: '1.5 Classic Plus PhotoFusion X Cinza / Extra Dark Cinza', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-10,00 a +6,00', cylindrical: '-6,00', diameter: '72', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 746, silver: 746, platinum: 746, gold: 746 } },
    { code: '5193', name: 'Poli Classic Plus PhotoFusion X Cinza / Extra Dark Cinza', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-10,00 a +6,00', cylindrical: '-6,00', diameter: '72', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 998, silver: 998, platinum: 998, gold: 998 } },
    { code: '5206', name: '1.60 Classic Plus PhotoFusion X Cinza / Extra Dark Cinza', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-12,00 a -7,50 / -7,25 a +6,00', cylindrical: '-6,00', diameter: '74 / 76', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 1110, silver: 1110, platinum: 1110, gold: 1110 } },
    { code: '5204', name: '1.67 Classic Plus PhotoFusion X Cinza / Extra Dark Cinza', brandId: zeiss.id, categoryId: multifocais.id, spherical: '-12,00 a -7,50 / -7,25 a +6,00', cylindrical: '-6,00', diameter: '74 / 76', addition: '1,00 a 3,00', height: '14 A 18', ar: { chrome: 1630, silver: 1630, platinum: 1630, gold: 1630 } },

    // ── HOYA Visão Simples ──
    { code: '5899', name: '1.50', brandId: hoya.id, categoryId: visaoSimples.id, spherical: '-9,00 a +8,00', cylindrical: '-4,00', diameter: '75', addition: '-', priceNoAR: 123, ar: { chrome: 248, silver: 337, platinum: 0, gold: 0 } },
    { code: '5902', name: 'Policarbonato', brandId: hoya.id, categoryId: visaoSimples.id, spherical: '-9,00 a +8,00', cylindrical: '-4,00', diameter: '75', addition: '-', priceNoAR: 129, ar: { chrome: 254, silver: 343, platinum: 0, gold: 0 } },
    { code: '5904', name: 'Trivex', brandId: hoya.id, categoryId: visaoSimples.id, spherical: '-9,00 a +6,00', cylindrical: '-4,00', diameter: '74', addition: '-', priceNoAR: 222, ar: { chrome: 347, silver: 436, platinum: 0, gold: 0 } },
    { code: '50295', name: 'Trivex Sensity', brandId: hoya.id, categoryId: visaoSimples.id, spherical: '-9,00 a +6,00', cylindrical: '-4,00', diameter: '74', addition: '-', priceNoAR: 440, ar: { chrome: 565, silver: 654, platinum: 0, gold: 0 } },
    { code: '5900', name: '1.60', brandId: hoya.id, categoryId: visaoSimples.id, spherical: '-12,00 a +6,00', cylindrical: '-4,00', diameter: '70', addition: '-', priceNoAR: 0, ar: { chrome: 340, silver: 429, platinum: 0, gold: 0 } },
    { code: '5901', name: '1.67', brandId: hoya.id, categoryId: visaoSimples.id, spherical: '-12,00 a +8,00', cylindrical: '-4,00', diameter: '70', addition: '-', priceNoAR: 0, ar: { chrome: 371, silver: 460, platinum: 0, gold: 0 } },
    { code: '5903', name: '1.74', brandId: hoya.id, categoryId: visaoSimples.id, spherical: '-17,00 a +12,00', cylindrical: '-4,00', diameter: '65/70', addition: '-', priceNoAR: 0, ar: { chrome: 592, silver: 681, platinum: 0, gold: 0 } },
    { code: '6459', name: '1.56 INCOLOR C/ AR EXTERNO VERDE', brandId: hoya.id, categoryId: visaoSimples.id, spherical: '-9,00 a +8,00', cylindrical: '-4,00', diameter: '75', addition: '-', priceNoAR: 143, ar: { chrome: 0, silver: 0, platinum: 0, gold: 0 } },

    // ── HOYA Multifocais ──
    { code: '6783', name: 'Poli', brandId: hoya.id, categoryId: hoyaMulti.id, spherical: '-10,00 a +6,00', cylindrical: '-4,00', diameter: '75', addition: '0,75 a 3,50', priceNoAR: 279, ar: { chrome: 404, silver: 493, platinum: 0, gold: 0 } },
    { code: '6786', name: '1.67', brandId: hoya.id, categoryId: hoyaMulti.id, spherical: '-12,00 a +7,00', cylindrical: '-4,00', diameter: '70', addition: '0,75 a 3,50', priceNoAR: 0, ar: { chrome: 623, silver: 710, platinum: 0, gold: 0 } },
    { code: '6787', name: '1.74', brandId: hoya.id, categoryId: hoyaMulti.id, spherical: '-18,00 a +8,00', cylindrical: '-4,00', diameter: '65', addition: '0,75 a 3,50', priceNoAR: 0, ar: { chrome: 893, silver: 982, platinum: 1028, gold: 817 } },
  ]

  let count = 0
  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {
        name: p.name, spherical: p.spherical, cylindrical: p.cylindrical,
        diameter: p.diameter, addition: p.addition, height: p.height,
        priceNoAR: p.priceNoAR ?? null,
        brandId: p.brandId, categoryId: p.categoryId,
      },
      create: {
        code: p.code, name: p.name, brandId: p.brandId, categoryId: p.categoryId,
        spherical: p.spherical, cylindrical: p.cylindrical, diameter: p.diameter,
        addition: p.addition, height: p.height, priceNoAR: p.priceNoAR ?? null,
      },
    })

    const arPrices = [
      { treatmentId: dvChrome.id, price: p.ar.chrome },
      { treatmentId: dvSilver.id, price: p.ar.silver },
      { treatmentId: dvPlatinum.id, price: p.ar.platinum },
      { treatmentId: dvGoldUv.id, price: p.ar.gold },
    ].filter(t => t.price > 0)

    for (const tp of arPrices) {
      await prisma.productTreatment.upsert({
        where: { productId_treatmentId: { productId: product.id, treatmentId: tp.treatmentId } },
        update: { price: tp.price },
        create: { productId: product.id, treatmentId: tp.treatmentId, price: tp.price },
      })
    }
    count++
  }
  console.log(`✅ ${count} produtos criados/atualizados com tratamentos`)

  // ── Catálogo ──────────────────────────────
  await prisma.catalog.upsert({
    where: { id: 'seed-catalog-zeiss-multifocais' },
    update: {},
    create: {
      id: 'seed-catalog-zeiss-multifocais',
      title: 'LENTE ZEISS MULTIFOCAIS',
      subtitle: 'LENTE ZEISS Classic Plus Freeform Blueguard - LANÇAMENTO',
      badge: 'ALTURAS 14 A 18',
      brandId: zeiss.id, categoryId: multifocais.id,
      description: 'Unilentes: tecnologia, precisão e confiança para transformar cada lente em uma nova forma de enxergar o mundo.',
    },
  })
  console.log('✅ Catálogo criado')

  console.log('\n🎉 Seed concluído!')
  console.log('   Login: admin@unilentes.com.br / admin123')
}

main()
  .catch((e) => { console.error('❌ Erro no seed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
