import { Router } from 'express'
import { Request, Response, NextFunction } from 'express'
import { authGuard, requireAdmin } from '../../shared/middleware/auth.guard'
import { productService, productSchema, productBulkDeleteSchema, productBulkStatusSchema } from './product.service'
import { validate } from '../../shared/middleware/validate'
import { AppError } from '../../shared/middleware/error.handler'
import { importProductsFile, sheetMappingSchema, type SheetMapping } from './product.import'
import multer from 'multer'

export const productRouter = Router()
productRouter.use(authGuard)

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB — a tabela .xlsb tem ~17 MB por causa das imagens
  fileFilter: (_req, file, cb) => {
    if (!/\.(csv|xlsx|xlsb|xls)$/i.test(file.originalname)) {
      return cb(new AppError('Envie um arquivo .csv, .xlsx, .xlsb ou .xls.', 400) as unknown as null, false)
    }
    cb(null, true)
  },
})

function parseMapping(raw: unknown): SheetMapping | undefined {
  if (raw === undefined) return undefined
  try {
    return sheetMappingSchema.parse(JSON.parse(String(raw)))
  } catch {
    throw new AppError('Associação de abas inválida.', 400)
  }
}

// POST /api/products/import?dryRun=true&createMissing=true — dryRun valida e mostra o resumo sem gravar.
// Planilha sem o campo mapping devolve as abas encontradas para associar marca e categoria.
productRouter.post('/import', importUpload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('Nenhum arquivo enviado.', 400)
    const data = await importProductsFile(req.file, {
      dryRun:        req.query.dryRun === 'true',
      createMissing: req.query.createMissing === 'true',
      mapping:       parseMapping(req.body.mapping),
    })
    // Erros de validação voltam no corpo (200) para o front exibir a lista por linha
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

// Exclusão em lote é irreversível: restrita a ADMIN
productRouter.post('/bulk-delete', requireAdmin, validate(productBulkDeleteSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await productService.removeMany(req.body.ids)
    res.json({ status: 'success', data })
  } catch (e) { next(e) }
})

productRouter.post('/bulk-status', validate(productBulkStatusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await productService.setActiveMany(req.body.ids, req.body.isActive)
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
