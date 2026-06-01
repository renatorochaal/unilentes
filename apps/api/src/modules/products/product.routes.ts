import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { authGuard } from '../../shared/middleware/auth.guard'
import { productService, productSchema } from './product.service'
import { validate } from '../../shared/middleware/validate'

export const productRouter = Router()
productRouter.use(authGuard)

productRouter.get('/', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const result = await productService.list(req)
    res.json({ status: 'success', ...result })
  } catch (e) { next(e) }
})

productRouter.get('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await productService.getById(req.params.id)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

productRouter.post('/', validate(productSchema), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await productService.create(req.body)
    res.status(201).json({ status: 'success', data })
  } catch (e) { next(e) }
})

productRouter.put('/:id', validate(productSchema.partial()), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const data = await productService.update(req.params.id, req.body)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

productRouter.delete('/:id', async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    await productService.remove(req.params.id)
    res.json({ status: 'success', message: 'Produto removido.' })
  } catch (e) { next(e) }
})
