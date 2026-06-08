import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { authGuard } from '../../shared/middleware/auth.guard'
import { AppError } from '../../shared/middleware/error.handler'

export const uploadRouter = Router()
uploadRouter.use(authGuard)

const UPLOADS_DIR = path.resolve('./uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase()
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    cb(null, name)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new AppError('Apenas imagens são permitidas.', 400) as unknown as null, false)
    }
    cb(null, true)
  },
})

uploadRouter.post(
  '/image',
  upload.single('image'),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError('Nenhum arquivo enviado.', 400)
      const url = `/uploads/${req.file.filename}`
      res.json({ status: 'success', data: { url } })
    } catch (e) { next(e) }
  }
)
