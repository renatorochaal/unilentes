import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { authGuard } from '../../shared/middleware/auth.guard'
import { catalogService, catalogSchema } from './catalog.service'
import { validate } from '../../shared/middleware/validate'

export const catalogRouter = Router()
catalogRouter.use(authGuard)

catalogRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await catalogService.list()
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

catalogRouter.get('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await catalogService.getById(req.params.id)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

catalogRouter.post('/', validate(catalogSchema), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await catalogService.create(req.body)
    res.status(201).json({ status: 'success', data })
  } catch (e) { next(e) }
})

catalogRouter.put('/:id', validate(catalogSchema.partial()), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await catalogService.update(req.params.id, req.body)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

catalogRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await catalogService.remove(req.params.id)
    res.json({ status: 'success', message: 'Catálogo removido.' })
  } catch (e) { next(e) }
})
