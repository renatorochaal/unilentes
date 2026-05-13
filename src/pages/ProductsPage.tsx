import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { productService, type ProductFilters } from '../services/product.service'
import { brandService } from '../services/brand.service'
import { categoryService } from '../services/category.service'
import { treatmentService } from '../services/treatment.service'
import { Modal } from '../components/ui/Modal'
import { Pagination } from '../components/ui/Pagination'
import { PageLoader } from '../components/ui/LoadingSpinner'
import type { Product, Brand, Category, Treatment } from '../types'
import { useForm, useFieldArray } from 'react-hook-form'

// ── Formulário de produto ─────────────────────────────────────────────
interface TreatmentRow { treatmentId: string; price: number }
interface ProductFormData {
  code: string
  name: string
  brandId: string
  categoryId: string
  supplierId?: string
  spherical?: string
  cylindrical?: string
  diameter?: string
  addition?: string
  priceNoAR?: number
  height?: string
  availability?: string
  isActive: boolean
  notes?: string
  treatments: TreatmentRow[]
}

function ProductForm({
  initial,
  brands,
  categories,
  treatments: allTreatments,
  onSubmit,
  onCancel,
  loading,
}: {
  initial?: Product
  brands: Brand[]
  categories: Category[]
  treatments: Treatment[]
  onSubmit: (d: ProductFormData) => void
  onCancel: () => void
  loading: boolean
}) {
  const { register, handleSubmit, control, formState: { errors } } = useForm<ProductFormData>({
    defaultValues: {
      code:         initial?.code ?? '',
      name:         initial?.name ?? '',
      brandId:      initial?.brandId ?? '',
      categoryId:   initial?.categoryId ?? '',
      supplierId:   initial?.supplierId ?? '',
      spherical:    initial?.spherical ?? '',
      cylindrical:  initial?.cylindrical ?? '',
      diameter:     initial?.diameter ?? '',
      addition:     initial?.addition ?? '',
      priceNoAR:    initial?.priceNoAR ?? undefined,
      height:       initial?.height ?? '',
      availability: initial?.availability ?? '',
      isActive:     initial?.isActive ?? true,
      notes:        initial?.notes ?? '',
      treatments:   initial?.treatments.map((t) => ({ treatmentId: t.treatmentId, price: Number(t.price) })) ?? [],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'treatments' })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base">Código *</label>
          <input className="input-base" {...register('code', { required: true })} />
          {errors.code && <p className="text-xs text-danger mt-1">Obrigatório</p>}
        </div>
        <div>
          <label className="label-base">Nome *</label>
          <input className="input-base" {...register('name', { required: true })} />
          {errors.name && <p className="text-xs text-danger mt-1">Obrigatório</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base">Marca *</label>
          <select className="input-base" {...register('brandId', { required: true })}>
            <option value="">Selecione</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label-base">Categoria *</label>
          <select className="input-base" {...register('categoryId', { required: true })}>
            <option value="">Selecione</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label-base">Esférico</label>
          <input className="input-base" placeholder="ex: -6.00 a +4.00" {...register('spherical')} />
        </div>
        <div>
          <label className="label-base">Cilíndrico</label>
          <input className="input-base" placeholder="ex: -4.00" {...register('cylindrical')} />
        </div>
        <div>
          <label className="label-base">Diâmetro</label>
          <input className="input-base" placeholder="ex: 70" {...register('diameter')} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label-base">Adição</label>
          <input className="input-base" placeholder="ex: +1.00 a +3.50" {...register('addition')} />
        </div>
        <div>
          <label className="label-base">Altura</label>
          <input className="input-base" placeholder="ex: 14 a 18" {...register('height')} />
        </div>
        <div>
          <label className="label-base">Preço s/ AR (R$)</label>
          <input className="input-base" type="number" step="0.01" {...register('priceNoAR', { valueAsNumber: true })} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label-base">Disponibilidade</label>
          <input className="input-base" placeholder="ex: Pronta Entrega" {...register('availability')} />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-primary rounded" {...register('isActive')} />
            <span className="text-sm font-medium text-text-primary">Ativo</span>
          </label>
        </div>
      </div>

      <div>
        <label className="label-base">Observações</label>
        <textarea className="input-base" rows={2} {...register('notes')} />
      </div>

      {/* Tratamentos */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label-base mb-0">Tratamentos / Preços AR</label>
          <button
            type="button"
            onClick={() => append({ treatmentId: '', price: 0 })}
            className="text-xs text-primary hover:text-primary-600 font-medium"
          >
            + Adicionar
          </button>
        </div>
        <div className="space-y-2">
          {fields.map((field, idx) => (
            <div key={field.id} className="flex gap-2 items-center">
              <select className="input-base flex-1" {...register(`treatments.${idx}.treatmentId`)}>
                <option value="">Selecione</option>
                {allTreatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Preço"
                className="input-base w-32"
                {...register(`treatments.${idx}.price`, { valueAsNumber: true })}
              />
              <button type="button" onClick={() => remove(idx)} className="text-danger hover:text-red-700">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1">
          {loading ? 'Salvando...' : initial ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────
export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts]   = useState<Product[]>([])
  const [meta, setMeta]           = useState({ page: 1, totalPages: 1, total: 0, limit: 20 })
  const [brands, setBrands]       = useState<Brand[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState(searchParams.get('search') ?? '')
  const [brandFilter, setBrandFilter]   = useState(searchParams.get('brand') ?? '')
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') ?? '')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const page = Number(searchParams.get('page') ?? 1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const filters: ProductFilters = {
        page,
        limit: 20,
        ...(search ? { search } : {}),
        ...(brandFilter ? { brand: brandFilter } : {}),
        ...(categoryFilter ? { category: categoryFilter } : {}),
      }
      const res = await productService.list(filters)
      setProducts(res.data)
      setMeta(res.meta)
    } finally {
      setLoading(false)
    }
  }, [page, search, brandFilter, categoryFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    brandService.list({ limit: 200 }).then((r) => setBrands(r.data))
    categoryService.list({ limit: 200 }).then((r) => setCategories(r.data))
    treatmentService.list({ limit: 200 }).then((r) => setTreatments(r.data))
  }, [])

  function applyFilters() {
    const p: Record<string, string> = {}
    if (search) p.search = search
    if (brandFilter) p.brand = brandFilter
    if (categoryFilter) p.category = categoryFilter
    p.page = '1'
    setSearchParams(p)
  }

  async function handleSave(data: ProductFormData) {
    setSaving(true)
    try {
      const { treatments, ...rest } = data
      const payload = {
        ...rest,
        supplierId: rest.supplierId || null,
        priceNoAR:  rest.priceNoAR ?? null,
        treatments: treatments.map((t) => ({ treatmentId: t.treatmentId, price: t.price })),
      }
      if (editing) {
        await productService.update(editing.id, payload)
        toast.success('Produto atualizado.')
      } else {
        await productService.create(payload)
        toast.success('Produto criado.')
      }
      setModalOpen(false)
      setEditing(null)
      load()
    } catch {
      toast.error('Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }


  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await productService.remove(deleteTarget.id)
      toast.success('Produto removido.')
      setDeleteTarget(null)
      load()
    } catch {
      toast.error('Erro ao remover produto.')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Produtos</h1>
          <p className="text-sm text-text-secondary mt-0.5">{meta.total} produtos cadastrados</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true) }}
          className="btn-primary"
          id="btn-add-product"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Novo Produto
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="label-base">Busca</label>
          <input
            className="input-base"
            placeholder="Código ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
        </div>
        <div className="min-w-[160px]">
          <label className="label-base">Marca</label>
          <select className="input-base" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="">Todas</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="label-base">Categoria</label>
          <select className="input-base" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={applyFilters} className="btn-primary h-[42px]">Filtrar</button>
        {(search || brandFilter || categoryFilter) && (
          <button onClick={() => { setSearch(''); setBrandFilter(''); setCategoryFilter(''); setSearchParams({}) }} className="btn-secondary h-[42px]">Limpar</button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <PageLoader />
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M9 9h.01M15 9h.01"/></svg>
            <p className="mt-3 text-sm">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nome</th>
                  <th>Marca</th>
                  <th>Categoria</th>
                  <th>Esférico</th>
                  <th>S/ AR</th>
                  <th>Status</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs font-semibold text-text-primary">{p.code}</td>
                    <td className="font-medium text-text-primary">{p.name}</td>
                    <td className="text-text-secondary">{p.brand.name}</td>
                    <td className="text-text-secondary">{p.category.name}</td>
                    <td className="text-text-secondary text-xs">{p.spherical ?? '—'}</td>
                    <td className="text-text-secondary">
                      {p.priceNoAR != null
                        ? `R$ ${Number(p.priceNoAR).toFixed(2)}`
                        : '—'}
                    </td>
                    <td>
                      <span className={p.isActive ? 'badge-success' : 'badge-neutral'}>
                        {p.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditing(p); setModalOpen(true) }}
                          className="btn-ghost p-1.5"
                          title="Editar"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="btn-ghost p-1.5 hover:text-danger hover:bg-danger-light"
                          title="Excluir"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              limit={meta.limit}
              onPageChange={(p) => setSearchParams((prev) => { prev.set('page', String(p)); return prev })}
            />
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      <Modal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        title={editing ? 'Editar Produto' : 'Novo Produto'}
        size="xl"
      >
        <ProductForm
          initial={editing ?? undefined}
          brands={brands}
          categories={categories}
          treatments={treatments}
          onSubmit={handleSave}
          onCancel={() => { setModalOpen(false); setEditing(null) }}
          loading={saving}
        />
      </Modal>

      {/* Modal confirmar exclusão */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar exclusão"
        size="sm"
      >
        <p className="text-sm text-text-secondary mb-6">
          Tem certeza que deseja remover o produto <span className="font-semibold text-text-primary">"{deleteTarget?.name}"</span>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleDelete} className="btn-danger flex-1">Excluir</button>
        </div>
      </Modal>
    </div>
  )
}
