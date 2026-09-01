import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { exportService } from '../services/export.service'
import { brandService } from '../services/brand.service'
import { categoryService } from '../services/category.service'
import { catalogService } from '../services/catalog.service'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Modal } from '../components/ui/Modal'
import { ImageUpload } from '../components/ui/ImageUpload'
import type { Export, Brand, Category, Catalog } from '../types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_MAP: Record<Export['status'], { label: string; cls: string }> = {
  QUEUED:     { label: 'Na fila',     cls: 'badge-warning' },
  PROCESSING: { label: 'Processando', cls: 'badge-primary' },
  COMPLETED:  { label: 'Concluído',   cls: 'badge-success' },
  FAILED:     { label: 'Falhou',      cls: 'badge-danger'  },
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── BrandOrderPicker ───────────────────────────────────────────────────

interface BrandOrderPickerProps {
  brands: Brand[]
  order: string[]
  onChange: (order: string[]) => void
  images: Record<string, string>
  onImagesChange: (images: Record<string, string>) => void
}

function BrandOrderPicker({ brands, order, onChange, images, onImagesChange }: BrandOrderPickerProps) {
  const orderedBrands = [
    ...order.map(id => brands.find(b => b.id === id)).filter(Boolean) as Brand[],
    ...brands.filter(b => !order.includes(b.id)),
  ]

  function move(idx: number, dir: -1 | 1) {
    const ids = orderedBrands.map(b => b.id)
    const target = idx + dir
    if (target < 0 || target >= ids.length) return
    ;[ids[idx], ids[target]] = [ids[target], ids[idx]]
    onChange(ids)
  }

  function setBrandImage(brandId: string, url: string | null) {
    const next = { ...images }
    if (url) next[brandId] = url
    else delete next[brandId]
    onImagesChange(next)
  }

  return (
    <div className="space-y-1">
      {orderedBrands.map((brand, idx) => (
        <div key={brand.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-gray-50">
          <span className="text-xs font-bold text-text-placeholder w-4 text-center">{idx + 1}</span>
          <span className="flex-1 text-sm font-medium text-text-primary truncate">{brand.name}</span>
          <ImageUpload
            value={images[brand.id] ?? null}
            onChange={url => setBrandImage(brand.id, url)}
            size={28}
            shape="square"
            compact
          />
          <button
            type="button"
            onClick={() => move(idx, -1)}
            disabled={idx === 0}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-text-placeholder"
            title="Mover para cima"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => move(idx, 1)}
            disabled={idx === orderedBrands.length - 1}
            className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-text-placeholder"
            title="Mover para baixo"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}

// ── ExportsPage ────────────────────────────────────────────────────────

export function ExportsPage() {
  const [exports, setExports]     = useState<Export[]>([])
  const [brands, setBrands]       = useState<Brand[]>([])
  const [loading, setLoading]     = useState(true)
  const [creating, setCreating]   = useState(false)
  const [newModal, setNewModal]   = useState(false)
  const [delTarget, setDelTarget] = useState<Export | null>(null)

  const [exportType, setExportType]   = useState<'PDF' | 'CSV'>('PDF')
  const [brandOrder, setBrandOrder]   = useState<string[]>([])
  const [brandImages, setBrandImages] = useState<Record<string, string>>({})
  const [showBrandOrder, setShowBrandOrder] = useState(false)
  const [headerImageUrl, setHeaderImageUrl] = useState<string>('')

  // Escopo do export: catálogo específico OU marca/categoria (opcionais) — sem
  // nenhum dos três, o backend exporta todos os catálogos/produtos ativos.
  const [catalogs, setCatalogs]             = useState<Catalog[]>([])
  const [scopeCatalogId, setScopeCatalogId] = useState('')
  const [scopeBrandId, setScopeBrandId]     = useState('')
  const [scopeCategoryId, setScopeCategoryId] = useState('')
  const [scopeCategories, setScopeCategories] = useState<Category[]>([])

  const exportsRef = useRef<Export[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await exportService.list()
      setExports(result)
      exportsRef.current = result
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    brandService.list({ limit: 200 }).then(r => setBrands(r.data))
    catalogService.list().then(setCatalogs)
  }, [load])

  // Categorias são por marca — recarrega ao trocar a marca do escopo.
  useEffect(() => {
    if (!scopeBrandId) {
      setScopeCategories([])
      setScopeCategoryId('')
      return
    }
    categoryService.list({ brandId: scopeBrandId, limit: 200 }).then(r => {
      setScopeCategories(r.data)
      setScopeCategoryId(prev => (prev && r.data.some(c => c.id === prev)) ? prev : '')
    })
  }, [scopeBrandId])

  function resetNewExportForm() {
    setBrandOrder([])
    setBrandImages({})
    setHeaderImageUrl('')
    setScopeCatalogId('')
    setScopeBrandId('')
    setScopeCategoryId('')
  }

  useEffect(() => {
    const interval = setInterval(() => {
      const hasPending = exportsRef.current.some(
        e => e.status === 'QUEUED' || e.status === 'PROCESSING'
      )
      if (hasPending) load()
    }, 5000)
    return () => clearInterval(interval)
  }, [load])

  async function handleCreate() {
    setCreating(true)
    try {
      // Payload FLAT — backend lê direto do req.body
      const payload: Record<string, unknown> = { type: exportType }
      // Catálogo específico tem prioridade sobre marca/categoria no backend
      // (export.service.ts ignora brandId/categoryId quando catalogId é enviado).
      if (scopeCatalogId) {
        payload.catalogId = scopeCatalogId
      } else {
        if (scopeBrandId)    payload.brandId    = scopeBrandId
        if (scopeCategoryId) payload.categoryId = scopeCategoryId
      }
      if (exportType === 'PDF' && brandOrder.length > 0)  payload.brandOrder     = brandOrder
      if (exportType === 'PDF' && headerImageUrl)          payload.headerImageUrl = headerImageUrl
      if (exportType === 'PDF' && Object.keys(brandImages).length > 0) payload.brandImages = brandImages
      await exportService.create(payload)
      toast.success(`Exportação ${exportType} enfileirada.`)
      setNewModal(false)
      resetNewExportForm()
      load()
    } catch {
      toast.error('Erro ao criar exportação.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete() {
    if (!delTarget) return
    try {
      await exportService.remove(delTarget.id)
      toast.success('Removido do histórico.')
      setDelTarget(null)
      load()
    } catch {
      toast.error('Erro ao remover.')
    }
  }

  async function handleDownload(exp: Export) {
    try {
      await exportService.download(exp.id, exp.fileName ?? `export.${exp.type.toLowerCase()}`, exp.type)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao baixar arquivo.')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Exportações</h1>
          <p className="text-sm text-text-secondary mt-0.5">Histórico de PDFs e CSVs gerados</p>
        </div>
        <button onClick={() => setNewModal(true)} className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Nova Exportação
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <PageLoader /> : exports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <p className="mt-3 text-sm">Nenhuma exportação ainda</p>
            <button onClick={() => setNewModal(true)} className="btn-primary mt-4 text-sm">Gerar primeiro export</button>
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Arquivo</th>
                <th>Tamanho</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Concluído</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {exports.map(e => {
                const status = STATUS_MAP[e.status]
                return (
                  <tr key={e.id}>
                    <td>
                      <span className={`badge ${e.type === 'PDF' ? 'badge-danger' : 'badge-primary'}`}>{e.type}</span>
                    </td>
                    <td className="text-sm text-text-secondary font-mono">{e.fileName ?? '—'}</td>
                    <td className="text-sm text-text-secondary">{e.fileSize ? formatBytes(e.fileSize) : '—'}</td>
                    <td><span className={status.cls}>{status.label}</span></td>
                    <td className="text-sm text-text-secondary">
                      {format(new Date(e.createdAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </td>
                    <td className="text-sm text-text-secondary">
                      {e.completedAt ? format(new Date(e.completedAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : '—'}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {e.status === 'COMPLETED' && (
                          <button onClick={() => handleDownload(e)} className="btn-ghost p-1.5 hover:text-primary" title="Download">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </button>
                        )}
                        {e.status === 'FAILED' && e.error && (
                          <span className="text-xs text-danger" title={e.error}>⚠ Erro</span>
                        )}
                        <button onClick={() => setDelTarget(e)} className="btn-ghost p-1.5 hover:text-danger hover:bg-danger-light" title="Remover">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nova exportação */}
      <Modal isOpen={newModal} onClose={() => { setNewModal(false); resetNewExportForm() }} title="Nova Exportação">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Selecione o formato de exportação:</p>

          <div className="grid grid-cols-2 gap-3">
            {(['PDF', 'CSV'] as const).map(t => (
              <button
                key={t}
                onClick={() => setExportType(t)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  exportType === t ? 'border-primary bg-primary-50' : 'border-border hover:border-primary/50'
                }`}
              >
                {t === 'PDF' ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={exportType === t ? '#54A7D9' : '#727784'} strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                ) : (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={exportType === t ? '#54A7D9' : '#727784'} strokeWidth="1.5">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                )}
                <span className={`text-sm font-semibold ${exportType === t ? 'text-primary' : 'text-text-secondary'}`}>{t}</span>
              </button>
            ))}
          </div>

          {/* Escopo: catálogo específico OU marca/categoria (ambos opcionais) */}
          <div className="space-y-3 border border-border rounded-xl p-4">
            <div>
              <label className="label-base">Catálogo específico</label>
              <select
                className="input-base w-full"
                value={scopeCatalogId}
                onChange={e => setScopeCatalogId(e.target.value)}
              >
                <option value="">Todos os catálogos ativos</option>
                {catalogs.map(c => (
                  <option key={c.id} value={c.id}>{c.brand.name} — {c.title}</option>
                ))}
              </select>
            </div>

            {!scopeCatalogId && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Marca</label>
                  <select
                    className="input-base w-full"
                    value={scopeBrandId}
                    onChange={e => setScopeBrandId(e.target.value)}
                  >
                    <option value="">Todas as marcas</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-base">Categoria</label>
                  <select
                    className="input-base w-full"
                    value={scopeCategoryId}
                    onChange={e => setScopeCategoryId(e.target.value)}
                    disabled={!scopeBrandId}
                  >
                    <option value="">Todas as categorias</option>
                    {scopeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Imagem do cabeçalho — apenas PDF */}
          {exportType === 'PDF' && (
            <div className="border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => {}}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-text-primary cursor-default"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                Imagem do cabeçalho
              </button>
              <div className="px-4 pb-4 pt-0 border-t border-border">
                <p className="text-xs text-text-placeholder mb-3 mt-2">
                  Aparece como fundo do header em todas as páginas do PDF. Recomendado 1200 × 300 px.
                </p>
                <ImageUpload
                  value={headerImageUrl || null}
                  onChange={url => setHeaderImageUrl(url ?? '')}
                  hint="PNG ou JPG — máx. 3 MB"
                  size={72}
                  shape="square"
                />
              </div>
            </div>
          )}

          {/* Brand order — apenas PDF */}
          {exportType === 'PDF' && brands.length > 1 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowBrandOrder(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-text-primary hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                  </svg>
                  Ordem das marcas no PDF
                </span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{ transform: showBrandOrder ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {showBrandOrder && (
                <div className="px-4 pb-4 pt-2 border-t border-border">
                  <p className="text-xs text-text-placeholder mb-3">
                    Use as setas para definir a ordem de aparição das marcas no PDF exportado. Clique no quadrado ao lado do nome para anexar um banner que aparece antes dos produtos daquela marca.
                  </p>
                  <BrandOrderPicker
                    brands={brands}
                    order={brandOrder}
                    onChange={setBrandOrder}
                    images={brandImages}
                    onImagesChange={setBrandImages}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={() => { setNewModal(false); resetNewExportForm() }} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleCreate} disabled={creating} className="btn-primary flex-1">
              {creating ? 'Gerando...' : 'Gerar Export'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar exclusão */}
      <Modal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Remover do histórico" size="sm">
        <p className="text-sm text-text-secondary mb-6">
          Remover o export <strong>{delTarget?.fileName ?? delTarget?.type}</strong> do histórico?
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDelTarget(null)} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleDelete} className="btn-danger flex-1">Remover</button>
        </div>
      </Modal>
    </div>
  )
}
