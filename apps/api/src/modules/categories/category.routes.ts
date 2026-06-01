import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { authGuard } from '../../shared/middleware/auth.guard'
import { categoryService, categorySchema } from './category.service'
import { validate } from '../../shared/middleware/validate'

export const categoryRouter = Router()
categoryRouter.use(authGuard)

categoryRouter.get('/', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.list(req.query.search as string)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

categoryRouter.get('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.getById(req.params.id)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

categoryRouter.post('/', validate(categorySchema), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.create(req.body)
    res.status(201).json({ status: 'success', data })
  } catch (e) { next(e) }
})

categoryRouter.put('/:id', validate(categorySchema.partial()), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await categoryService.update(req.params.id, req.body)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

categoryRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await categoryService.remove(req.params.id)
    res.json({ status: 'success', message: 'Categoria removida.' })
  } catch (e) { next(e) }
})
