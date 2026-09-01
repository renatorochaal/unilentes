import { useState, useEffect, useMemo } from 'react'
import { catalogService, type CatalogPayload } from '../services/catalog.service'
import { brandService } from '../services/brand.service'
import { categoryService } from '../services/category.service'
import { productService } from '../services/product.service'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ImageUpload } from '../components/ui/ImageUpload'
import toast from 'react-hot-toast'
const uuidv4 = () => crypto.randomUUID()

import type {
  Catalog, CatalogWithProducts, Brand, Category, Product,
  CatalogSection, ColumnVisibility,
} from '../types'

// ── Helpers ────────────────────────────────────────────────────────────

function formatPrice(val: number | null | undefined): string {
  if (val == null) return '—'
  return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function resolveColumns(vis?: ColumnVisibility | null) {
  return {
    spherical:    vis?.spherical    !== false,
    cylindrical:  vis?.cylindrical  !== false,
    diameter:     vis?.diameter     !== false,
    addition:     vis?.addition     !== false,
    priceNoAR:    vis?.priceNoAR    !== false,
    availability: vis?.availability === true,
  }
}

// ── SectionEditor ──────────────────────────────────────────────────────

interface SectionEditorProps {
  sections: CatalogSection[]
  availableProducts: Product[]
  onChange: (sections: CatalogSection[]) => void
}

function SectionEditor({ sections, availableProducts, onChange }: SectionEditorProps) {
  function addSection() {
    onChange([...sections, { id: uuidv4(), title: '', headerImage: null, productIds: [] }])
  }

  function removeSection(id: string) {
    onChange(sections.filter(s => s.id !== id))
  }

  function updateSection(id: string, patch: Partial<CatalogSection>) {
    onChange(sections.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const next = [...sections]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  function addProductToSection(sectionId: string, productId: string) {
    onChange(sections.map(s =>
      s.id === sectionId && !s.productIds.includes(productId)
        ? { ...s, productIds: [...s.productIds, productId] }
        : s
    ))
  }

  function removeProductFromSection(sectionId: string, productId: string) {
    onChange(sections.map(s =>
      s.id === sectionId
        ? { ...s, productIds: s.productIds.filter(id => id !== productId) }
        : s
    ))
  }

  function moveProduct(sectionId: string, pidIdx: number, dir: -1 | 1) {
    onChange(sections.map(s => {
      if (s.id !== sectionId) return s
      const ids = [...s.productIds]
      const target = pidIdx + dir
      if (target < 0 || target >= ids.length) return s
      ;[ids[pidIdx], ids[target]] = [ids[target], ids[pidIdx]]
      return { ...s, productIds: ids }
    }))
  }

  const usedProductIds = new Set(sections.flatMap(s => s.productIds))

  return (
    <div className="space-y-3">
      {sections.length === 0 && (
        <p className="text-xs text-text-placeholder text-center py-3 border border-dashed border-border rounded-lg">
          Sem seções. Todos os produtos serão exibidos em uma única tabela.
        </p>
      )}

      {sections.map((sec, si) => (
        <div key={sec.id} className="border border-border rounded-xl overflow-hidden">
          {/* Section header bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-border">
            <span className="text-xs font-semibold text-text-placeholder">SEÇÃO {si + 1}</span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => moveSection(si, -1)}
              disabled={si === 0}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-text-placeholder"
              title="Mover para cima"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => moveSection(si, 1)}
              disabled={si === sections.length - 1}
              className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 text-text-placeholder"
              title="Mover para baixo"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => removeSection(sec.id)}
              className="p-1 rounded hover:bg-danger-light hover:text-danger text-text-placeholder"
              title="Remover seção"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="p-3 space-y-2">
            <input
              type="text"
              placeholder="Título da seção (ex: PROGRESSIVA MAX HD EVOLUTION)"
              value={sec.title}
              onChange={e => updateSection(sec.id, { title: e.target.value })}
              className="input-base w-full text-sm"
            />
            <ImageUpload
              value={sec.headerImage ?? null}
              onChange={url => updateSection(sec.id, { headerImage: url })}
              size={56}
              hint="Imagem separadora exibida entre seções (opcional)"
            />

            {/* Products in section */}
            <div>
              <p className="text-[11px] font-semibold text-text-placeholder uppercase tracking-wider mb-1.5">
                Produtos desta seção ({sec.productIds.length})
              </p>

              {sec.productIds.length === 0 ? (
                <p className="text-xs text-text-placeholder">Nenhum produto. Adicione abaixo.</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {sec.productIds.map((pid, pidIdx) => {
                    const prod = availableProducts.find(p => p.id === pid)
                    if (!prod) return null
                    return (
                      <div key={pid} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-gray-50">
                        <span className="font-mono font-semibold text-primary w-10 shrink-0">{prod.code}</span>
                        <span className="flex-1 truncate text-text-secondary">{prod.name}</span>
                        <button type="button" onClick={() => moveProduct(sec.id, pidIdx, -1)} disabled={pidIdx === 0} className="p-0.5 hover:text-primary disabled:opacity-30">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button type="button" onClick={() => moveProduct(sec.id, pidIdx, 1)} disabled={pidIdx === sec.productIds.length - 1} className="p-0.5 hover:text-primary disabled:opacity-30">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <button type="button" onClick={() => removeProductFromSection(sec.id, pid)} className="p-0.5 hover:text-danger text-text-placeholder">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add product picker */}
              {availableProducts.filter(p => !usedProductIds.has(p.id)).length > 0 && (
                <select
                  className="input-base w-full text-xs mt-2"
                  value=""
                  onChange={e => { if (e.target.value) addProductToSection(sec.id, e.target.value) }}
                >
                  <option value="">+ Adicionar produto à seção...</option>
                  {availableProducts
                    .filter(p => !usedProductIds.has(p.id))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))
                  }
                </select>
              )}
            </div>
          </div>
        </div>
      ))}

      <button type="button" onClick={addSection} className="btn-secondary w-full text-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Adicionar Seção
      </button>
    </div>
  )
}

// ── CatalogFormModal ───────────────────────────────────────────────────

const DEFAULT_COLUMNS: ColumnVisibility = {
  spherical: true, cylindrical: true, diameter: true,
  addition: true, priceNoAR: true, availability: false,
}

interface CatalogFormModalProps {
  catalog?: Catalog | null
  onClose: () => void
  onSaved: () => void
}

function CatalogFormModal({ catalog, onClose, onSaved }: CatalogFormModalProps) {
  const [brands, setBrands]         = useState<Brand[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts]     = useState<Product[]>([])
  const [saving, setSaving]         = useState(false)
  const [tab, setTab]               = useState<'basic' | 'columns' | 'sections'>('basic')

  const [form, setForm] = useState<CatalogPayload>({
    title:          catalog?.title          ?? '',
    subtitle:       catalog?.subtitle       ?? '',
    badge:          catalog?.badge          ?? '',
    brandId:        catalog?.brandId        ?? '',
    categoryId:     catalog?.categoryId     ?? '',
    headerImage:    catalog?.headerImage    ?? '',
    description:    catalog?.description    ?? '',
    crmUrl:         catalog?.crmUrl         ?? '',
    sortOrder:      catalog?.sortOrder      ?? 0,
    isActive:       catalog?.isActive       ?? true,
    visibleColumns: catalog?.visibleColumns ?? DEFAULT_COLUMNS,
    sections:       catalog?.sections       ?? null,
  })
  const [productsLoaded, setProductsLoaded] = useState(false)

  useEffect(() => {
    brandService.list({ limit: 200 }).then(r => setBrands(r.data))
  }, [])

  // Categorias são por marca — recarrega ao trocar a marca e limpa a
  // categoria selecionada se ela não pertencer mais à marca atual.
  useEffect(() => {
    if (!form.brandId) {
      setCategories([])
      return
    }
    categoryService.list({ brandId: form.brandId, limit: 200 }).then(r => {
      setCategories(r.data)
      setForm(f => (f.categoryId && !r.data.some(c => c.id === f.categoryId))
        ? { ...f, categoryId: '' }
        : f)
    })
  }, [form.brandId])

  // Reload products when brand+category changes
  useEffect(() => {
    if (form.brandId && form.categoryId) {
      setProductsLoaded(false)
      productService.list({ brand: form.brandId, category: form.categoryId, limit: 500 })
        .then(r => { setProducts(r.data); setProductsLoaded(true) })
    } else {
      setProducts([])
      setProductsLoaded(false)
    }
  }, [form.brandId, form.categoryId])

  // Remove das seções produtos que não pertencem mais à marca/categoria
  // atual (ex.: usuário trocou a categoria depois de montar as seções).
  useEffect(() => {
    if (!productsLoaded) return
    setForm(f => {
      if (!f.sections?.length) return f
      const validIds = new Set(products.map(p => p.id))
      let removed = 0
      const nextSections = f.sections.map(sec => {
        const filtered = sec.productIds.filter(pid => validIds.has(pid))
        removed += sec.productIds.length - filtered.length
        return filtered.length === sec.productIds.length ? sec : { ...sec, productIds: filtered }
      })
      if (removed === 0) return f
      toast.error(`${removed} produto(s) removido(s) das seções por não pertencerem mais à marca/categoria selecionada.`)
      return { ...f, sections: nextSections }
    })
  }, [products, productsLoaded])

  function set<K extends keyof CatalogPayload>(key: K, value: CatalogPayload[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleColumn(key: keyof ColumnVisibility) {
    setForm(f => ({
      ...f,
      visibleColumns: {
        ...(f.visibleColumns ?? DEFAULT_COLUMNS),
        [key]: !(f.visibleColumns ?? DEFAULT_COLUMNS)[key],
      },
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Título obrigatório.')
    if (!form.brandId)      return toast.error('Marca obrigatória.')
    if (!form.categoryId)   return toast.error('Categoria obrigatória.')

    setSaving(true)
    try {
      const payload: CatalogPayload = {
        ...form,
        subtitle:    form.subtitle    || null,
        badge:       form.badge       || null,
        headerImage: form.headerImage || null,
        description: form.description || null,
        crmUrl:      form.crmUrl      || null,
      }
      if (catalog?.id) await catalogService.update(catalog.id, payload)
      else             await catalogService.create(payload)
      toast.success(catalog?.id ? 'Catálogo atualizado.' : 'Catálogo criado.')
      onSaved()
    } catch {
      toast.error('Erro ao salvar catálogo.')
    } finally {
      setSaving(false)
    }
  }

  const cols = form.visibleColumns ?? DEFAULT_COLUMNS
  const columnLabels: { key: keyof ColumnVisibility; label: string }[] = [
    { key: 'spherical',   label: 'Esférico' },
    { key: 'cylindrical', label: 'Cil' },
    { key: 'diameter',    label: 'Ø (Diâmetro)' },
    { key: 'addition',    label: 'Adição' },
    { key: 'priceNoAR',   label: 'Sem AR' },
    { key: 'availability', label: 'Disponibilidade' },
  ]

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={catalog?.id ? 'Editar Catálogo' : 'Novo Catálogo'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tab navigation */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {(['basic', 'columns', 'sections'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                tab === t ? 'bg-white text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t === 'basic' ? 'Dados Gerais' : t === 'columns' ? 'Colunas' : 'Seções'}
            </button>
          ))}
        </div>

        {/* ── Tab: basic ── */}
        {tab === 'basic' && (
          <div className="space-y-3">
            <div>
              <label className="label-base">Título *</label>
              <input
                className="input-base w-full"
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Ex: LENTE ZEISS MULTIFOCAIS"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Subtítulo</label>
                <input className="input-base w-full" value={form.subtitle ?? ''} onChange={e => set('subtitle', e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <label className="label-base">Badge</label>
                <input className="input-base w-full" value={form.badge ?? ''} onChange={e => set('badge', e.target.value)} placeholder="Ex: ALTURAS 14 A 18" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Marca *</label>
                <select className="input-base w-full" value={form.brandId} onChange={e => set('brandId', e.target.value)} required>
                  <option value="">Selecione...</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-base">Categoria *</label>
                <select className="input-base w-full" value={form.categoryId} onChange={e => set('categoryId', e.target.value)} required>
                  <option value="">Selecione...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label-base">URL do Botão "Fazer Pedido" (CRM)</label>
              <input
                className="input-base w-full"
                value={form.crmUrl ?? ''}
                onChange={e => set('crmUrl', e.target.value)}
                placeholder="https://crm.empresa.com/pedido?catalogo=..."
              />
            </div>
            <div>
              <label className="label-base">Imagem do Banner</label>
              <ImageUpload
                value={form.headerImage ?? null}
                onChange={url => set('headerImage', url)}
                size={80}
                hint="PNG ou JPG — máx. 3 MB. Exibida como fundo do banner do catálogo."
              />
            </div>
            <div>
              <label className="label-base">Descrição</label>
              <textarea className="input-base w-full resize-none" rows={2} value={form.description ?? ''} onChange={e => set('description', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Ordem de exibição</label>
                <input className="input-base w-full" type="number" min={0} value={form.sortOrder ?? 0} onChange={e => set('sortOrder', Number(e.target.value))} />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive ?? true}
                    onChange={e => set('isActive', e.target.checked)}
                    className="w-4 h-4 rounded border-border text-primary"
                  />
                  <span className="text-sm text-text-primary">Ativo</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: columns ── */}
        {tab === 'columns' && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">Selecione quais colunas devem aparecer na tabela deste catálogo.</p>
            <div className="space-y-2">
              {columnLabels.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:border-primary/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={(cols as Record<string, boolean>)[key] ?? false}
                    onChange={() => toggleColumn(key)}
                    className="w-4 h-4 rounded border-border text-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-text-primary">{label}</span>
                    {key === 'availability' && (
                      <span className="ml-2 text-xs text-text-placeholder">(oculto por padrão)</span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: sections ── */}
        {tab === 'sections' && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Divida o catálogo em seções (ex: por linha de produto). Cada seção pode ter um título e imagem própria.
              {!form.brandId || !form.categoryId ? (
                <span className="text-orange-500 ml-1">Selecione marca e categoria primeiro.</span>
              ) : products.length === 0 ? (
                <span className="text-text-placeholder ml-1">Nenhum produto encontrado nesta marca/categoria.</span>
              ) : null}
            </p>
            <SectionEditor
              sections={form.sections ?? []}
              availableProducts={products}
              onChange={secs => set('sections', secs.length ? secs : null)}
            />
          </div>
        )}

        <div className="flex gap-3 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Salvando...' : catalog?.id ? 'Salvar alterações' : 'Criar catálogo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── CatalogProductTable (admin view) ───────────────────────────────────

function CatalogProductTable({
  catalog,
  search,
}: {
  catalog: CatalogWithProducts
  search: string
}) {
  const cols = resolveColumns(catalog.visibleColumns)

  const treatmentNames = useMemo(() =>
    Array.from(new Set(catalog.products.flatMap(p => p.treatments.map(t => t.treatment.name)))).sort()
  , [catalog.products])

  const filteredProducts = useMemo(() => {
    if (!search) return catalog.products
    const q = search.toLowerCase()
    return catalog.products.filter(p =>
      p.code.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q)
    )
  }, [catalog.products, search])

  const sections = useMemo(() => {
    const secs = catalog.sections
    if (!secs?.length) return [{ id: '__all', title: '', headerImage: null as string | null, products: filteredProducts }]

    return secs.map(sec => ({
      ...sec,
      products: sec.productIds
        .map(pid => filteredProducts.find(p => p.id === pid))
        .filter(Boolean) as typeof filteredProducts,
    })).filter(sec => sec.products.length > 0)
  }, [catalog, filteredProducts])

  if (filteredProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-placeholder">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p className="mt-2 text-sm">Nenhum produto encontrado{search ? ` para "${search}"` : ''}.</p>
      </div>
    )
  }

  return (
    <div>
      {sections.map(sec => (
        <div key={sec.id}>
          {sec.id !== '__all' && (
            sec.headerImage ? (
              <div className="relative overflow-hidden" style={{ height: '80px' }}>
                <img src={sec.headerImage} alt={sec.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center px-4" style={{ background: 'rgba(26,58,82,0.65)' }}>
                  <span className="text-sm font-bold text-white">{sec.title}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-primary-900/90">
                <div className="w-0.5 h-4 rounded-full bg-primary" />
                <span className="text-xs font-bold text-white uppercase tracking-wide">{sec.title}</span>
              </div>
            )
          )}

          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Cod. WEB</th>
                  <th>Material</th>
                  {cols.spherical   && <th>Esférico</th>}
                  {cols.cylindrical && <th>Cil</th>}
                  {cols.diameter    && <th>Ø</th>}
                  {cols.addition    && <th>Adição</th>}
                  {cols.priceNoAR   && <th className="text-right">Sem AR</th>}
                  {cols.availability && <th>Disponib.</th>}
                  {treatmentNames.length > 0 && (
                    <th colSpan={treatmentNames.length} className="text-center bg-primary-50 text-primary-700 border-l border-primary-200">
                      Com Antirreflexo (AR)
                    </th>
                  )}
                </tr>
                {treatmentNames.length > 0 && (
                  <tr>
                    <th colSpan={
                      2 +
                      (cols.spherical ? 1 : 0) +
                      (cols.cylindrical ? 1 : 0) +
                      (cols.diameter ? 1 : 0) +
                      (cols.addition ? 1 : 0) +
                      (cols.priceNoAR ? 1 : 0) +
                      (cols.availability ? 1 : 0)
                    } />
                    {treatmentNames.map(name => (
                      <th key={name} className="text-right bg-primary-50/60 text-primary-600 border-l border-primary-200/50">
                        {name}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {sec.products.map(p => {
                  const priceMap = Object.fromEntries(p.treatments.map(t => [t.treatment.name, t.price]))
                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-xs font-semibold">{p.code}</td>
                      <td className="font-medium">{p.name}</td>
                      {cols.spherical   && <td className="text-xs text-text-secondary">{p.spherical   ?? '—'}</td>}
                      {cols.cylindrical && <td className="text-xs text-text-secondary text-center">{p.cylindrical ?? '—'}</td>}
                      {cols.diameter    && <td className="text-xs text-text-secondary text-center">{p.diameter    ?? '—'}</td>}
                      {cols.addition    && <td className="text-xs text-text-secondary">{p.addition    ?? '—'}</td>}
                      {cols.priceNoAR   && <td className="text-right font-medium">{formatPrice(p.priceNoAR)}</td>}
                      {cols.availability && <td className="text-xs text-text-secondary text-center">{p.availability ?? '—'}</td>}
                      {treatmentNames.map(name => (
                        <td key={name} className="text-right border-l border-primary-100">
                          {priceMap[name] != null ? formatPrice(priceMap[name]) : '—'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── CatalogView ────────────────────────────────────────────────────────

function CatalogView({
  catalog,
  onEdit,
  onDelete,
}: {
  catalog: CatalogWithProducts
  onEdit: () => void
  onDelete: () => void
}) {
  const [search, setSearch] = useState('')

  return (
    <div className="card overflow-hidden">
      {/* Hero */}
      <div
        className="relative flex items-end overflow-hidden"
        style={{ minHeight: '160px', background: 'linear-gradient(135deg, #1a3a52 0%, #54A7D9 100%)' }}
      >
        {catalog.headerImage && (
          <img src={catalog.headerImage} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.18 }} />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(26,58,82,0.85) 0%, transparent 100%)' }} />
        <div className="relative z-10 p-5 flex items-end justify-between gap-4 w-full">
          <div className="flex-1 min-w-0">
            {catalog.badge && (
              <span className="inline-block mb-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide bg-white/20 text-white">
                {catalog.badge}
              </span>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/50 mb-0.5">
              {catalog.brand.name} · {catalog.category.name}
            </p>
            <h2 className="text-lg font-bold text-white leading-tight">{catalog.title}</h2>
            {catalog.subtitle && <p className="text-xs mt-0.5 text-white/70">{catalog.subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {catalog.crmUrl && (
              <a
                href={catalog.crmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105"
                style={{ backgroundColor: '#54A7D9', boxShadow: '0 2px 8px rgba(84,167,217,0.5)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                Fazer Pedido
              </a>
            )}
            <button
              onClick={() => {
                const url = `${window.location.origin}/c/${catalog.id}`
                navigator.clipboard.writeText(url).then(() => {
                  toast.success('Link público copiado!')
                }).catch(() => {
                  // Fallback para browsers sem clipboard API
                  const input = document.createElement('input')
                  input.value = url
                  document.body.appendChild(input)
                  input.select()
                  document.execCommand('copy')
                  document.body.removeChild(input)
                  toast.success('Link público copiado!')
                })
              }}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Copiar link público"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </button>
            <button onClick={onEdit} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors" title="Editar catálogo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/40 text-white transition-colors" title="Excluir catálogo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border bg-gray-50/50">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar por código ou nome..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
      </div>

      {/* Table */}
      {catalog.products.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-text-placeholder text-sm">
          Nenhum produto ativo nesta categoria.
        </div>
      ) : (
        <CatalogProductTable catalog={catalog} search={search} />
      )}
    </div>
  )
}

// ── CatalogPage ────────────────────────────────────────────────────────

export function CatalogPage() {
  const [catalogs, setCatalogs]       = useState<Catalog[]>([])
  const [selected, setSelected]       = useState<CatalogWithProducts | null>(null)
  const [loading, setLoading]         = useState(true)
  const [loadingDetail, setDetail]    = useState(false)
  const [formOpen, setFormOpen]       = useState(false)
  const [editing, setEditing]         = useState<Catalog | null>(null)
  const [delTarget, setDelTarget]     = useState<Catalog | null>(null)
  const [filterSearch, setFilterSearch] = useState('')

  async function loadCatalogs() {
    setLoading(true)
    try {
      const data = await catalogService.list({ all: true })
      setCatalogs(data)
      if (selected) {
        // Catálogo selecionado pode ter sido editado (ex.: categoria trocada) —
        // recarrega o detalhe para refletir o estado atual na tela.
        if (data.some(c => c.id === selected.id)) await loadDetail(selected.id)
        else setSelected(null)
      } else if (data.length > 0) {
        await loadDetail(data[0].id)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadDetail(id: string) {
    setDetail(true)
    try {
      const data = await catalogService.getById(id)
      setSelected(data)
    } finally {
      setDetail(false)
    }
  }

  useEffect(() => { loadCatalogs() }, []) // eslint-disable-line

  async function handleDelete() {
    if (!delTarget) return
    try {
      await catalogService.remove(delTarget.id)
      toast.success('Catálogo removido.')
      setDelTarget(null)
      if (selected?.id === delTarget.id) setSelected(null)
      await loadCatalogs()
    } catch {
      toast.error('Erro ao remover catálogo.')
    }
  }

  const filteredCatalogs = useMemo(() => {
    if (!filterSearch) return catalogs
    const q = filterSearch.toLowerCase()
    return catalogs.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.brand.name.toLowerCase().includes(q) ||
      c.category.name.toLowerCase().includes(q)
    )
  }, [catalogs, filterSearch])

  if (loading) return <PageLoader />

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de Preços</h1>
          <p className="text-sm text-text-secondary mt-0.5">Tabelas de lentes por marca e categoria</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/c"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Catálogo Público
          </a>
          <button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Novo Catálogo
          </button>
        </div>
      </div>

      {/* Filter / catalog selector */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-placeholder" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Filtrar catálogos..."
            className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {filteredCatalogs.map(c => (
            <button
              key={c.id}
              onClick={() => loadDetail(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                selected?.id === c.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-primary/50'
              } ${!c.isActive ? 'opacity-50' : ''}`}
            >
              {c.brand.name} — {c.title}
              {!c.isActive && <span className="text-[9px] font-semibold uppercase">(inativo)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog detail */}
      {loadingDetail ? (
        <div className="flex items-center justify-center py-16"><PageLoader /></div>
      ) : selected ? (
        <CatalogView
          catalog={selected}
          onEdit={() => { setEditing(catalogs.find(c => c.id === selected.id) ?? null); setFormOpen(true) }}
          onDelete={() => setDelTarget(catalogs.find(c => c.id === selected.id) ?? null)}
        />
      ) : catalogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-text-placeholder">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
          <h2 className="mt-4 text-lg font-semibold text-text-primary">Nenhum catálogo criado</h2>
          <p className="text-sm mt-1">Crie o primeiro catálogo para exibir tabelas de preços.</p>
          <button onClick={() => setFormOpen(true)} className="btn-primary mt-4">Criar catálogo</button>
        </div>
      ) : null}

      {/* Form modal */}
      {formOpen && (
        <CatalogFormModal
          catalog={editing}
          onClose={() => { setFormOpen(false); setEditing(null) }}
          onSaved={() => {
            setFormOpen(false)
            setEditing(null)
            loadCatalogs()
          }}
        />
      )}

      {/* Delete confirm */}
      <Modal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Excluir Catálogo" size="sm">
        <p className="text-sm text-text-secondary mb-6">
          Excluir o catálogo <strong>{delTarget?.title}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDelTarget(null)} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleDelete} className="btn-danger flex-1">Excluir</button>
        </div>
      </Modal>
    </div>
  )
}
