import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { brandService } from '../services/brand.service'
import { categoryService } from '../services/category.service'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { ImageUpload } from '../components/ui/ImageUpload'
import type { Brand, Category } from '../types'
import { useForm } from 'react-hook-form'

interface BrandForm { name: string; description?: string; logoUrl?: string; isActive: boolean }
interface CategoryForm { name: string; description?: string; isActive: boolean }

export function BrandDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Brand edit
  const [editingBrand, setEditingBrand] = useState(false)
  const brandForm = useForm<BrandForm>()

  // Category CRUD
  const [catModal, setCatModal] = useState(false)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [delCat, setDelCat] = useState<Category | null>(null)
  const catForm = useForm<CategoryForm>()

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await brandService.getById(id)
      setBrand(data)
    } catch {
      toast.error('Marca não encontrada.')
      navigate('/brands')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  // ── Brand Edit ──────────────────────────────
  function openBrandEdit() {
    if (!brand) return
    brandForm.reset({
      name: brand.name,
      description: brand.description ?? '',
      logoUrl: brand.logoUrl ?? '',
      isActive: brand.isActive,
    })
    setEditingBrand(true)
  }

  async function onBrandSubmit(d: BrandForm) {
    if (!brand) return
    setSaving(true)
    try {
      await brandService.update(brand.id, d)
      toast.success('Marca atualizada.')
      setEditingBrand(false)
      load()
    } catch { toast.error('Erro ao salvar.') }
    finally { setSaving(false) }
  }

  // ── Category CRUD ───────────────────────────
  function openCreateCat() {
    catForm.reset({ name: '', description: '', isActive: true })
    setEditingCat(null)
    setCatModal(true)
  }

  function openEditCat(c: Category) {
    catForm.reset({ name: c.name, description: c.description ?? '', isActive: c.isActive })
    setEditingCat(c)
    setCatModal(true)
  }

  async function onCatSubmit(d: CategoryForm) {
    if (!brand) return
    setSaving(true)
    try {
      if (editingCat) {
        await categoryService.update(editingCat.id, d)
        toast.success('Categoria atualizada.')
      } else {
        await categoryService.create({ ...d, brandId: brand.id })
        toast.success('Categoria criada.')
      }
      setCatModal(false)
      load()
    } catch { toast.error('Erro ao salvar categoria.') }
    finally { setSaving(false) }
  }

  async function handleDeleteCat() {
    if (!delCat) return
    try {
      await categoryService.remove(delCat.id)
      toast.success('Categoria removida.')
      setDelCat(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao remover.')
    }
  }

  if (loading) return <PageLoader />
  if (!brand) return null

  const categories = brand.categories ?? []

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/brands')}
          className="btn-ghost p-2 rounded-lg"
          title="Voltar"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="page-title">{brand.name}</h1>
          <p className="text-sm text-text-secondary mt-0.5">{brand.description || 'Sem descrição'}</p>
        </div>
        <span className={brand.isActive ? 'badge-success' : 'badge-neutral'}>
          {brand.isActive ? 'Ativa' : 'Inativa'}
        </span>
        <button onClick={openBrandEdit} className="btn-secondary gap-2">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editar
        </button>
      </div>

      {/* Brand Info Card */}
      <div className="card p-5 mb-6">
        <div className="flex items-start gap-5">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="w-16 h-16 object-contain rounded-xl border border-border bg-gray-50 p-1" />
          ) : (
            <div className="w-16 h-16 rounded-xl border border-border bg-gray-100 flex items-center justify-center text-text-placeholder">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
          )}
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] font-semibold text-text-placeholder uppercase tracking-wider mb-1">Produtos</p>
              <p className="text-lg font-bold text-text-primary">{brand._count?.products ?? 0}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-text-placeholder uppercase tracking-wider mb-1">Categorias</p>
              <p className="text-lg font-bold text-text-primary">{categories.length}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-text-placeholder uppercase tracking-wider mb-1">Criada em</p>
              <p className="text-sm text-text-secondary">{new Date(brand.createdAt).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-text-primary">Categorias</h2>
        <button onClick={openCreateCat} className="btn-primary text-sm" id="btn-add-category">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Nova Categoria
        </button>
      </div>

      <div className="card overflow-hidden">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-text-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 opacity-40">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <p className="text-sm">Nenhuma categoria cadastrada para esta marca</p>
            <button onClick={openCreateCat} className="text-primary text-sm font-semibold mt-2 hover:underline">
              + Criar primeira categoria
            </button>
          </div>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Descrição</th>
                <th className="text-center">Produtos</th>
                <th>Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold text-text-primary">{c.name}</td>
                  <td className="text-text-secondary text-sm">{c.description ?? '—'}</td>
                  <td className="text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 text-xs font-bold text-text-secondary">
                      {c._count?.products ?? 0}
                    </span>
                  </td>
                  <td>
                    <span className={c.isActive ? 'badge-success' : 'badge-neutral'}>
                      {c.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEditCat(c)} className="btn-ghost p-1.5" title="Editar">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button onClick={() => setDelCat(c)} className="btn-ghost p-1.5 hover:text-danger hover:bg-danger-light" title="Excluir">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Brand Edit Modal */}
      <Modal isOpen={editingBrand} onClose={() => setEditingBrand(false)} title="Editar Marca">
        <form onSubmit={brandForm.handleSubmit(onBrandSubmit)} className="space-y-4">
          <div>
            <label className="label-base">Nome *</label>
            <input className="input-base" {...brandForm.register('name', { required: true })} />
          </div>
          <div>
            <label className="label-base">Descrição</label>
            <input className="input-base" {...brandForm.register('description')} />
          </div>
          <div>
            <label className="label-base">Logo</label>
            <ImageUpload
              value={brandForm.watch('logoUrl') ?? null}
              onChange={url => brandForm.setValue('logoUrl', url ?? '')}
              shape="square"
              size={72}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-primary w-4 h-4" {...brandForm.register('isActive')} />
            <span className="text-sm font-medium text-text-primary">Ativa</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setEditingBrand(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>

      {/* Category Create/Edit Modal */}
      <Modal isOpen={catModal} onClose={() => setCatModal(false)} title={editingCat ? 'Editar Categoria' : 'Nova Categoria'}>
        <form onSubmit={catForm.handleSubmit(onCatSubmit)} className="space-y-4">
          <div>
            <label className="label-base">Nome *</label>
            <input className="input-base" {...catForm.register('name', { required: true })} />
            {catForm.formState.errors.name && <p className="text-xs text-danger mt-1">Obrigatório</p>}
          </div>
          <div>
            <label className="label-base">Descrição</label>
            <input className="input-base" {...catForm.register('description')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-primary w-4 h-4" {...catForm.register('isActive')} />
            <span className="text-sm font-medium text-text-primary">Ativa</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCatModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Salvando...' : editingCat ? 'Salvar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Category Confirmation */}
      <Modal isOpen={!!delCat} onClose={() => setDelCat(null)} title="Confirmar exclusão" size="sm">
        <p className="text-sm text-text-secondary mb-6">
          Remover a categoria <strong>"{delCat?.name}"</strong>?
          {(delCat?._count?.products ?? 0) > 0 && (
            <span className="block text-danger text-xs mt-2">
              ⚠ Esta categoria possui {delCat?._count?.products} produto(s) associado(s).
            </span>
          )}
        </p>
        <div className="flex gap-3">
          <button onClick={() => setDelCat(null)} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleDeleteCat} className="btn-danger flex-1">Excluir</button>
        </div>
      </Modal>
    </div>
  )
}
