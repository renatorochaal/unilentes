import { app } from './app'
import { env } from './config/env'
import { prisma } from './config/prisma'
import fs from 'fs'
import path from 'path'

async function bootstrap() {
  // Garantir que o diretório de exports existe
  const exportsDir = path.resolve(env.EXPORTS_DIR)
  if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir, { recursive: true })
  }

  // Testar conexão com o banco
  try {
    await prisma.$connect()
    console.log('✅ Conectado ao PostgreSQL')
  } catch (err) {
    console.error('❌ Falha ao conectar ao banco de dados:', err)
    process.exit(1)
  }

  app.listen(env.PORT, () => {
    console.log(`🚀 API rodando em http://localhost:${env.PORT}`)
    console.log(`   Ambiente: ${env.NODE_ENV}`)
  })

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM recebido. Encerrando...')
    await prisma.$disconnect()
    process.exit(0)
  })
}

bootstrap()
