import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { authGuard } from '../../shared/middleware/auth.guard'
import { treatmentService, treatmentSchema } from './treatment.service'
import { validate } from '../../shared/middleware/validate'

export const treatmentRouter = Router()
treatmentRouter.use(authGuard)

treatmentRouter.get('/', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await treatmentService.list(req.query.search as string)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

treatmentRouter.get('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await treatmentService.getById(req.params.id)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

treatmentRouter.post('/', validate(treatmentSchema), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await treatmentService.create(req.body)
    res.status(201).json({ status: 'success', data })
  } catch (e) { next(e) }
})

treatmentRouter.put('/:id', validate(treatmentSchema.partial()), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await treatmentService.update(req.params.id, req.body)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

treatmentRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await treatmentService.remove(req.params.id)
    res.json({ status: 'success', message: 'Tratamento removido.' })
  } catch (e) { next(e) }
})
