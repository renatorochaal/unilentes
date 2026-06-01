import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/middleware/error.handler'
import { ExportStatus, ExportType } from '@prisma/client'
import { env } from '../../config/env'
import path from 'path'
import fs from 'fs'
import { generateCsv } from './csv.generator'
import { generatePdf } from './pdf.generator'
import { z } from 'zod'

export const exportRequestSchema = z.object({
  type:       z.enum(['PDF', 'CSV']),
  brandId:    z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  catalogId:  z.string().uuid().optional(),
})

export type ExportFilters = z.infer<typeof exportRequestSchema>

export const exportService = {
  async list(userId: string) {
    return prisma.export.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  },

  async getById(id: string, userId: string) {
    const exp = await prisma.export.findUnique({ where: { id } })
    if (!exp) throw new AppError('Export não encontrado.', 404)
    if (exp.userId !== userId) throw new AppError('Acesso negado.', 403)
    return exp
  },

  async enqueue(userId: string, filters: ExportFilters) {
    const record = await prisma.export.create({
      data: {
        userId,
        type: filters.type as ExportType,
        status: ExportStatus.QUEUED,
        filters: filters as object,
      },
    })

    // Processar de forma assíncrona (sem Redis — in-process queue simples)
    setImmediate(() => {
      this.process(record.id).catch((err) => {
        console.error('Export worker error:', err)
      })
    })

    return record
  },

  async process(exportId: string) {
    await prisma.export.update({
      where: { id: exportId },
      data: { status: ExportStatus.PROCESSING },
    })

    const record = await prisma.export.findUnique({ where: { id: exportId } })
    if (!record) return

    const filters = (record.filters ?? {}) as ExportFilters

    try {
      // Buscar produtos com base nos filtros
      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          ...(filters.brandId    ? { brandId: filters.brandId }       : {}),
          ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        },
        orderBy: { code: 'asc' },
        include: {
          brand:    { select: { name: true } },
          category: { select: { name: true } },
          treatments: {
            include: { treatment: { select: { name: true } } },
            orderBy: { treatment: { name: 'asc' } },
          },
        },
      })

      const exportsDir = path.resolve(env.EXPORTS_DIR)
      const timestamp  = Date.now()
      let fileName: string
      let filePath: string
      let fileSize: number

      if (record.type === ExportType.CSV) {
        fileName = `catalogo_${timestamp}.csv`
        filePath = path.join(exportsDir, fileName)
        const csv = generateCsv(products)
        fs.writeFileSync(filePath, csv, 'utf8')
        fileSize = Buffer.byteLength(csv, 'utf8')
      } else {
        fileName = `catalogo_${timestamp}.pdf`
        filePath = path.join(exportsDir, fileName)
        const pdfBuffer = await generatePdf(products)
        fs.writeFileSync(filePath, pdfBuffer)
        fileSize = pdfBuffer.length
      }

      await prisma.export.update({
        where: { id: exportId },
        data: {
          status: ExportStatus.COMPLETED,
          fileName,
          fileUrl:     `/exports/${fileName}`,
          fileSize,
          completedAt: new Date(),
        },
      })
    } catch (err) {
      console.error('Export processing failed:', err)
      await prisma.export.update({
        where: { id: exportId },
        data: {
          status: ExportStatus.FAILED,
          error:  err instanceof Error ? err.message : 'Erro desconhecido',
        },
      })
    }
  },

  async getDownloadPath(id: string, userId: string) {
    const record = await this.getById(id, userId)
    if (record.status !== ExportStatus.COMPLETED || !record.fileName) {
      throw new AppError('Export ainda não está disponível para download.', 409)
    }
    const filePath = path.resolve(env.EXPORTS_DIR, record.fileName)
    if (!fs.existsSync(filePath)) {
      throw new AppError('Arquivo não encontrado no servidor.', 404)
    }
    return { filePath, fileName: record.fileName, type: record.type }
  },

  async remove(id: string, userId: string) {
    const record = await this.getById(id, userId)
    // Remover arquivo se existir
    if (record.fileName) {
      const filePath = path.resolve(env.EXPORTS_DIR, record.fileName)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }
    return prisma.export.delete({ where: { id } })
  },
}
