import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { exportService } from '../services/export.service'
import { PageLoader } from '../components/ui/LoadingSpinner'
import { Modal } from '../components/ui/Modal'
import type { Export } from '../types'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS_MAP: Record<Export['status'], { label: string; cls: string }> = {
  QUEUED:     { label: 'Na fila',    cls: 'badge-warning' },
  PROCESSING: { label: 'Processando', cls: 'badge-primary' },
  COMPLETED:  { label: 'Concluído',  cls: 'badge-success' },
  FAILED:     { label: 'Falhou',     cls: 'badge-danger' },
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function ExportsPage() {
  const [exports, setExports] = useState<Export[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newModal, setNewModal] = useState(false)
  const [exportType, setExportType] = useState<'PDF' | 'CSV'>('PDF')
  const [delTarget, setDelTarget] = useState<Export | null>(null)

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
  }, [load])

  // Polling separado — não depende do state exports
  useEffect(() => {
    const interval = setInterval(() => {
      const hasPending = exportsRef.current.some(
        (e) => e.status === 'QUEUED' || e.status === 'PROCESSING'
      )
      if (hasPending) load()
    }, 5000)
    return () => clearInterval(interval)
  }, [load])

  async function handleCreate() {
    setCreating(true)
    try {
      await exportService.create({ type: exportType })
      toast.success(`Exportação ${exportType} enfileirada.`)
      setNewModal(false)
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
        <button onClick={() => setNewModal(true)} className="btn-primary" id="btn-new-export">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Nova Exportação
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <PageLoader /> : exports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
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
              {exports.map((e) => {
                const status = STATUS_MAP[e.status]
                return (
                  <tr key={e.id}>
                    <td>
                      <span className={`badge ${e.type === 'PDF' ? 'badge-danger' : 'badge-primary'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="text-sm text-text-secondary font-mono">{e.fileName ?? '—'}</td>
                    <td className="text-sm text-text-secondary">
                      {e.fileSize ? formatBytes(e.fileSize) : '—'}
                    </td>
                    <td>
                      <span className={status.cls}>{status.label}</span>
                    </td>
                    <td className="text-sm text-text-secondary">
                      {format(new Date(e.createdAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                    </td>
                    <td className="text-sm text-text-secondary">
                      {e.completedAt
                        ? format(new Date(e.completedAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
                        : '—'}
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {e.status === 'COMPLETED' && (
                          <button
                            onClick={() => handleDownload(e)}
                            className="btn-ghost p-1.5 hover:text-primary"
                            title="Download"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </button>
                        )}
                        {e.status === 'FAILED' && e.error && (
                          <span className="text-xs text-danger" title={e.error}>⚠ Erro</span>
                        )}
                        <button
                          onClick={() => setDelTarget(e)}
                          className="btn-ghost p-1.5 hover:text-danger hover:bg-danger-light"
                          title="Remover do histórico"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
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
      <Modal isOpen={newModal} onClose={() => setNewModal(false)} title="Nova Exportação" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Selecione o formato de exportação:</p>
          <div className="grid grid-cols-2 gap-3">
            {(['PDF', 'CSV'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setExportType(t)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  exportType === t
                    ? 'border-primary bg-primary-50'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {t === 'PDF' ? (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={exportType === t ? '#54A7D9' : '#727784'} strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
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
          <div className="flex gap-3 pt-2">
            <button onClick={() => setNewModal(false)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={handleCreate} disabled={creating} className="btn-primary flex-1">
              {creating ? 'Gerando...' : 'Gerar Export'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar exclusão */}
      <Modal isOpen={!!delTarget} onClose={() => setDelTarget(null)} title="Remover do histórico" size="sm">
        <p className="text-sm text-text-secondary mb-6">Remover o export <strong>{delTarget?.fileName ?? delTarget?.type}</strong> do histórico?</p>
        <div className="flex gap-3">
          <button onClick={() => setDelTarget(null)} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={handleDelete} className="btn-danger flex-1">Remover</button>
        </div>
      </Modal>
    </div>
  )
}
