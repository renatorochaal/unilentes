import { PrismaClient, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Admin user (legado)
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@unilentes.com.br' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@unilentes.com.br',
      password: hashedPassword,
      role: Role.ADMIN,
    },
  })
  console.log('✅ Usuário admin criado:', admin.email)

  // Admin user principal
  const hashedPassword2 = await bcrypt.hash('Admin@123', 10)
  const admin2 = await prisma.user.upsert({
    where: { email: 'admin@unilente.com.br' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@unilente.com.br',
      password: hashedPassword2,
      role: Role.ADMIN,
    },
  })
  console.log('✅ Usuário admin criado:', admin2.email)


  // Marcas
  const zeiss = await prisma.brand.upsert({
    where: { name: 'ZEISS' },
    update: {},
    create: { name: 'ZEISS', description: 'Carl Zeiss Vision' },
  })
  const hoya = await prisma.brand.upsert({
    where: { name: 'HOYA' },
    update: {},
    create: { name: 'HOYA', description: 'Hoya Vision Care' },
  })
  console.log('✅ Marcas criadas')

  // Categorias
  const multifocais = await prisma.category.upsert({
    where: { name: 'Multifocais' },
    update: {},
    create: { name: 'Multifocais', description: 'Lentes progressivas e multifocais' },
  })
  const visaoSimples = await prisma.category.upsert({
    where: { name: 'Visão Simples' },
    update: {},
    create: { name: 'Visão Simples', description: 'Lentes de visão simples' },
  })
  console.log('✅ Categorias criadas')

  // Tratamentos
  const treatments = await Promise.all([
    prisma.treatment.upsert({ where: { name: 'DV Chrome' }, update: {}, create: { name: 'DV Chrome' } }),
    prisma.treatment.upsert({ where: { name: 'DV Silver' }, update: {}, create: { name: 'DV Silver' } }),
    prisma.treatment.upsert({ where: { name: 'DV Platinum' }, update: {}, create: { name: 'DV Platinum' } }),
    prisma.treatment.upsert({ where: { name: 'DV Gold UV' }, update: {}, create: { name: 'DV Gold UV' } }),
  ])
  const [dvChrome, dvSilver, dvPlatinum, dvGoldUv] = treatments
  console.log('✅ Tratamentos criados')

  // Produtos de exemplo (baseados no tabela.json)
  const productsData = [
    { code: '5179', name: '1.50', spherical: '-7,00 a +5,00 / -7,00 a 5,00', cylindrical: '-6,00', diameter: '75', addition: '1,00 a 3,50 / 1,00 a 3,00', height: '14 A 18', prices: { dvChrome: 290, dvSilver: 290, dvPlatinum: 290, dvGoldUv: 290 } },
    { code: '5181', name: 'Poli', spherical: '-10,00 a +6,00', cylindrical: '-6,00', diameter: '75', addition: '1,00 a 3,00', height: '14 A 18', prices: { dvChrome: 410, dvSilver: 410, dvPlatinum: 410, dvGoldUv: 410 } },
    { code: '5180', name: '1.60', spherical: '-12,00 a -7,50 / -7,25 a +6,00', cylindrical: '-6,00', diameter: '74 / 76', addition: '1,00 a 3,00', height: '14 A 18', prices: { dvChrome: 522, dvSilver: 522, dvPlatinum: 522, dvGoldUv: 522 } },
    { code: '5182', name: '1.67', spherical: '-12,00 a -7,50 / -7,25 a +6,00', cylindrical: '-6,00', diameter: '74 / 76', addition: '1,00 a 3,00', height: '14 A 18', prices: { dvChrome: 1042, dvSilver: 1042, dvPlatinum: 1042, dvGoldUv: 1042 } },
    { code: '5183', name: '1.5 Classic Plus PhotoFusion X Cinza', spherical: '-10,00 a +6,00', cylindrical: '-6,00', diameter: '72', addition: '1,00 a 3,00', height: '14 A 18', prices: { dvChrome: 726, dvSilver: 726, dvPlatinum: 726, dvGoldUv: 726 } },
  ]

  for (const p of productsData) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: {
        code: p.code,
        name: p.name,
        brandId: zeiss.id,
        categoryId: multifocais.id,
        spherical: p.spherical,
        cylindrical: p.cylindrical,
        diameter: p.diameter,
        addition: p.addition,
        height: p.height,
      },
    })

    // Preços por tratamento
    const treatmentPrices = [
      { treatmentId: dvChrome.id, price: p.prices.dvChrome },
      { treatmentId: dvSilver.id, price: p.prices.dvSilver },
      { treatmentId: dvPlatinum.id, price: p.prices.dvPlatinum },
      { treatmentId: dvGoldUv.id, price: p.prices.dvGoldUv },
    ]

    for (const tp of treatmentPrices) {
      await prisma.productTreatment.upsert({
        where: { productId_treatmentId: { productId: product.id, treatmentId: tp.treatmentId } },
        update: { price: tp.price },
        create: { productId: product.id, treatmentId: tp.treatmentId, price: tp.price },
      })
    }
  }
  console.log('✅ Produtos criados com preços de tratamento')

  // Catálogo de exemplo
  await prisma.catalog.upsert({
    where: { id: 'seed-catalog-zeiss-multifocais' },
    update: {},
    create: {
      id: 'seed-catalog-zeiss-multifocais',
      title: 'LENTE ZEISS MULTIFOCAIS',
      subtitle: 'LENTE ZEISS Classic Plus Freeform Blueguard - LANÇAMENTO',
      badge: 'ALTURAS 14 A 18',
      brandId: zeiss.id,
      categoryId: multifocais.id,
      description: 'Unilentes: tecnologia, precisão e confiança para transformar cada lente em uma nova forma de enxergar o mundo.',
    },
  })
  console.log('✅ Catálogo criado')

  console.log('\n🎉 Seed concluído!')
  console.log('   Login: admin@unilentes.com.br / admin123')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
