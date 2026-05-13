import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { supplierService } from '../services/supplier.service'
import { Modal } from '../components/ui/Modal'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Pagination } from '../components/ui/Pagination'
import type { Supplier } from '../types'
import { useForm } from 'react-hook-form'

interface SupplierForm { name: string; cnpj?: string; email?: string; phone?: string; isActive: boolean }

export function SuppliersPage() {
  const [items, setItems]   = useState<Supplier[]>([])
  const [meta, setMeta]     = useState({ page: 1, totalPages: 1, total: 0, limit: 20 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [delTarget, setDelTarget] = useState<Supplier | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await supplierService.list({ search: search || undefined, page, limit: 20 }); setItems(r.data); setMeta(r.meta) }
    finally { setLoading(false) }
  }, [search, page])

  useEffect(() => { load() }, [load])

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierForm>()

  function openCreate() { reset({ name: '', isActive: true }); setEditing(null); setModal(true) }
  function openEdit(s: Supplier) { reset({ name: s.name, cnpj: s.cnpj ?? '', email: s.email ?? '', phone: s.phone ?? '', isActive: s.isActive }); setEditing(s); setModal(true) }

  async function onSubmit(d: SupplierForm) {
    setSaving(true)
    try {
      if (editing) { await supplierService.update(editing.id, d); toast.success('Fornecedor atualizado.') }
      else { await supplierService.create(d); toast.success('Fornecedor criado.') }
      setModal(false); load()
    } catch { toast.error('Erro ao salvar.') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!delTarget) return
    try { await supplierService.remove(delTarget.id); toast.success('Removido.'); setDelTarget(null); load() }
    catch { toast.error('Erro ao remover.') }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fornecedores</h1>
          <p className="text-sm text-text-secondary mt-0.5">{meta.total} fornecedores</p>
        </div>
        <button onClick={openCreate} className="btn-primary" id="btn-add-supplier">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          Novo Fornecedor
        </button>
      </div>

      <div className="card p-4 mb-4">
        <input className="input-base" placeholder="Buscar fornecedor..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
      </div>

      <div className="card overflow-hidden">
        {loading ? <PageLoader /> : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-text-placeholder"><p className="text-sm">Nenhum fornecedor encontrado</p></div>
        ) : (
          <>
            <table className="table-base">
              <thead><tr><th>Nome</th><th>CNPJ</th><th>E-mail</th><th>Telefone</th><th>Status</th><th className="text-right">Ações</th></tr></thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold text-text-primary">{s.name}</td>
                    <td className="text-text-secondary text-sm font-mono">{s.cnpj ?? '—'}</td>
                    <td className="text-text-secondary text-sm">{s.email ?? '—'}</td>
                    <td className="text-text-secondary text-sm">{s.phone ?? '—'}</td>
                    <td><span className={s.isActive ? 'badge-success' : 'badge-neutral'}>{s.isActive ? 'Ativo' : 'Inativo'}</span></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(s)} className="btn-ghost p-1.5" title="Editar">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => setDelTarget(s)} className="btn-ghost p-1.5 hover:text-danger hover:bg-danger-light">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />
          </>
        )}
      </div>

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label-base">Nome *</label>
            <input className="input-base" {...register('name', { required: true })} />
            {errors.name && <p className="text-xs text-danger mt-1">Obrigatório</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">CNPJ</label>
              <input className="input-base font-mono" placeholder="00.000.000/0000-00" {...register('cnpj')} />
            </div>
            <div>
              <label className="label-base">Telefone</label>
              <input className="input-base" placeholder="(00) 00000-0000" {...register('phone')} />
            </div>
          </div>
          <div>
            <label className="label-base">E-mail</label>
            <input className="input-base" type="email" {...register('email')} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="accent-primary w-4 h-4" {...register('isActive')} />
            <span className="text-sm font-medium text-text-primary">Ativo</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Confirmar exclusão" size="sm">
        <p className="text-sm text-text-secondary mb-6">Remover <strong>"{delTarget?.name}"</strong>?</p>
        <div className="flex gap-3">
          <button onClick={() => setDelTarget(null)} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleDelete} className="btn-danger flex-1">Excluir</button>
        </div>
      </Modal>
    </div>
  )
}
