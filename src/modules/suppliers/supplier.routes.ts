import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { authGuard } from '../../shared/middleware/auth.guard'
import { supplierService, supplierSchema } from './supplier.service'
import { validate } from '../../shared/middleware/validate'

export const supplierRouter = Router()
supplierRouter.use(authGuard)

supplierRouter.get('/', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await supplierService.list(req.query.search as string)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

supplierRouter.get('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await supplierService.getById(req.params.id)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

supplierRouter.post('/', validate(supplierSchema), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await supplierService.create(req.body)
    res.status(201).json({ status: 'success', data })
  } catch (e) { next(e) }
})

supplierRouter.put('/:id', validate(supplierSchema.partial()), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await supplierService.update(req.params.id, req.body)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

supplierRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await supplierService.remove(req.params.id)
    res.json({ status: 'success', message: 'Fornecedor removido.' })
  } catch (e) { next(e) }
})
