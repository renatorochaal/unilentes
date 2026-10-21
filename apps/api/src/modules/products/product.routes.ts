import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { authGuard } from '../../shared/middleware/auth.guard'
import { productService, productSchema } from './product.service'
import { validate } from '../../shared/middleware/validate'
import { AppError } from '../../shared/middleware/error.handler'
import { importProductsCsv } from './product.import'
import multer from 'multer'

export const productRouter = Router()
productRouter.use(authGuard)

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (!/\.csv$/i.test(file.originalname)) {
      return cb(new AppError('Envie um arquivo .csv.', 400) as unknown as null, false)
    }
    cb(null, true)
  },
})

// POST /api/products/import?dryRun=true — valida e mostra o resumo sem gravar
productRouter.post('/import', csvUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('Nenhum arquivo enviado.', 400)
    const data = await importProductsCsv(req.file.buffer, req.query.dryRun === 'true')
    // Erros de validação voltam no corpo (200) para o front exibir a lista por linha
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

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
