import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { authGuard } from '../../shared/middleware/auth.guard'
import { exportService, exportRequestSchema } from './export.service'
import { validate } from '../../shared/middleware/validate'

export const exportRouter = Router()
exportRouter.use(authGuard)

exportRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await exportService.list(req.user!.sub)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

exportRouter.post('/', validate(exportRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await exportService.enqueue(req.user!.sub, req.body)
    res.status(202).json({ status: 'success', data: record, message: 'Exportação enfileirada.' })
  } catch (e) { next(e) }
})

exportRouter.get('/:id/download', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const { filePath, fileName, type } = await exportService.getDownloadPath(req.params.id, req.user!.sub)
    const contentType = type === 'CSV' ? 'text/csv; charset=utf-8' : 'application/pdf'
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.sendFile(filePath)
  } catch (e) { next(e) }
})


exportRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await exportService.remove(req.params.id, req.user!.sub)
    res.json({ status: 'success', message: 'Export removido.' })
  } catch (e) { next(e) }
})
