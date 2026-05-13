import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { authGuard } from '../../shared/middleware/auth.guard'
import { brandService, brandSchema } from './brand.service'
import { validate } from '../../shared/middleware/validate'

export const brandRouter = Router()
brandRouter.use(authGuard)

brandRouter.get('/', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await brandService.list(req.query.search as string)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

brandRouter.get('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await brandService.getById(req.params.id)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

brandRouter.post('/', validate(brandSchema), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await brandService.create(req.body)
    res.status(201).json({ status: 'success', data })
  } catch (e) { next(e) }
})

brandRouter.put('/:id', validate(brandSchema.partial()), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await brandService.update(req.params.id, req.body)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

brandRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await brandService.remove(req.params.id)
    res.json({ status: 'success', message: 'Marca removida.' })
  } catch (e) { next(e) }
})
