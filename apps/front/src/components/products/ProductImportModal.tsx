import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import { productService, type ProductImportResult } from '../../services/product.service'
import type { Treatment } from '../../types'

const FIXED_HEADERS = [
  'Cod. WEB', 'Material', 'Marca', 'Categoria', 'Esférico', 'Cil', 'Ø',
  'Adição', 'Alturas', 'Disponibilidade', 'Sem AR',
]

interface ProductImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
  treatments: Treatment[]
}

/** Importação em duas etapas: validação (dry run) e confirmação. */
export function ProductImportModal({ isOpen, onClose, onImported, treatments }: ProductImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ProductImportResult | null>(null)
  const [busy, setBusy] = useState(false)

  function reset() {
    setFile(null)
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function validate(f: File) {
    setFile(f)
    setPreview(null)
    setBusy(true)
    try {
      setPreview(await productService.importCsv(f, true))
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao validar o arquivo.')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!file) return
    setBusy(true)
    try {
      const result = await productService.importCsv(file, false)
      if (result.errors.length) {
        // Banco mudou entre a validação e a confirmação
        setPreview(result)
        toast.error('O arquivo tem erros — nada foi gravado.')
        return
      }
      toast.success(`Importação concluída: ${result.created} criado(s), ${result.updated} atualizado(s).`)
      onImported()
      handleClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao importar.')
    } finally {
      setBusy(false)
    }
  }

  function downloadTemplate() {
    const headers = [...FIXED_HEADERS, ...treatments.map((t) => t.name), 'Status']
    const line = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(';')
    // BOM + ";" para o Excel pt-BR abrir com acentos e colunas corretas
    const blob = new Blob(['﻿' + line + '\r\n'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo-importacao-produtos.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasErrors = !!preview?.errors.length

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar produtos (CSV)" size="lg">
      <div className="space-y-4">
        <div className="text-sm text-text-secondary space-y-1">
          <p>
            Mesmo layout do export CSV: <strong>Cod. WEB, Material, Marca, Categoria</strong> são obrigatórios;
            as demais colunas são opcionais. Cada coluna extra deve ter o nome exato de um tratamento cadastrado.
          </p>
          <p>
            Produtos são atualizados pelo Cod. WEB; códigos novos são criados. Marca e categoria precisam existir.
            Célula vazia ou "-" num tratamento remove o preço dele. Se houver qualquer erro, nada é gravado.
          </p>
          <button type="button" onClick={downloadTemplate} className="text-xs text-primary hover:text-primary-600 font-medium">
            Baixar modelo CSV
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="input-base"
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) validate(f) }}
        />

        {busy && <p className="text-sm text-text-secondary">Processando...</p>}

        {preview && (
          <div className="rounded-md border border-border p-3 text-sm space-y-2">
            <p>
              <strong>{preview.total}</strong> linha(s) no arquivo
              {!hasErrors && <> — <strong>{preview.created}</strong> a criar, <strong>{preview.updated}</strong> a atualizar</>}
            </p>
            {preview.treatmentColumns.length > 0 && (
              <p className="text-text-secondary">Tratamentos: {preview.treatmentColumns.join(', ')}</p>
            )}
            {hasErrors && (
              <div>
                <p className="text-danger font-medium mb-1">{preview.errors.length} erro(s) — corrija o arquivo e envie novamente:</p>
                <ul className="max-h-60 overflow-y-auto text-xs space-y-0.5">
                  {preview.errors.map((err, i) => (
                    <li key={i}>
                      <span className="font-mono">Linha {err.line}</span>
                      {err.code && <span className="font-mono"> [{err.code}]</span>}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={handleClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !preview || hasErrors || preview.total === 0}
            className="btn-primary flex-1"
          >
            {busy ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
