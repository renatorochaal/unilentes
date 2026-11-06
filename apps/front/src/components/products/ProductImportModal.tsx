import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Modal } from '../ui/Modal'
import {
  productService,
  type ImportSheetSummary,
  type ProductImportResult,
  type SheetMapping,
} from '../../services/product.service'
import type { Brand, Treatment } from '../../types'

const FIXED_HEADERS = [
  'Cod. WEB', 'Material', 'Marca', 'Categoria', 'Esférico', 'Cil', 'Ø',
  'Adição', 'Alturas', 'Disponibilidade', 'Sem AR',
]

interface SheetRow extends ImportSheetSummary {
  selected: boolean
  brand: string
  category: string
}

interface ProductImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImported: () => void
  treatments: Treatment[]
  brands: Brand[]
}

/**
 * Importação em etapas: leitura do arquivo, associação de abas a marca e
 * categoria (só planilhas), validação (dry run) e confirmação.
 */
export function ProductImportModal({ isOpen, onClose, onImported, treatments, brands }: ProductImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<SheetRow[]>([])
  const [preview, setPreview] = useState<ProductImportResult | null>(null)
  const [createMissing, setCreateMissing] = useState(true)
  const [busy, setBusy] = useState(false)

  const selectedSheets = sheets.filter((s) => s.selected)
  const mapping: SheetMapping[] | undefined = sheets.length
    ? selectedSheets.map((s) => ({ sheet: s.name, brand: s.brand.trim(), category: s.category.trim() }))
    : undefined
  const mappingIncomplete = !!mapping && (mapping.length === 0 || mapping.some((m) => !m.brand || !m.category))

  function reset() {
    setFile(null)
    setSheets([])
    setPreview(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function readFile(f: File) {
    setFile(f)
    setSheets([])
    setPreview(null)
    setBusy(true)
    try {
      const result = await productService.importFile(f, { dryRun: true, createMissing })
      if (result.needsMapping) {
        setSheets(result.sheets.map((s) => ({
          ...s, selected: true, brand: s.suggestedBrand, category: s.suggestedCategory,
        })))
      } else {
        setPreview(result)
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao ler o arquivo.')
    } finally {
      setBusy(false)
    }
  }

  async function validate(nextCreateMissing = createMissing) {
    if (!file) return
    setBusy(true)
    try {
      setPreview(await productService.importFile(file, { dryRun: true, createMissing: nextCreateMissing, mapping }))
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
      const result = await productService.importFile(file, { dryRun: false, createMissing, mapping })
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

  function updateSheet(name: string, patch: Partial<SheetRow>) {
    setPreview(null)
    setSheets((rows) => rows.map((s) => (s.name === name ? { ...s, ...patch } : s)))
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
  const newRecords = preview
    ? preview.newBrands.length + preview.newCategories.length + preview.newTreatments.length
    : 0

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar produtos" size="xl">
      <div className="space-y-4">
        <div className="text-sm text-text-secondary space-y-1">
          <p>
            Aceita a <strong>tabela de preços em Excel</strong> (.xlsx, .xlsb ou .xls) ou um <strong>CSV</strong> no
            layout do modelo. Produtos são atualizados pelo Cod. WEB e códigos novos são criados.
          </p>
          <p>
            Preço vazio ou "-" num tratamento remove o preço daquele produto. Se houver qualquer erro, nada é gravado.
          </p>
          <button type="button" onClick={downloadTemplate} className="text-xs text-primary hover:text-primary-600 font-medium">
            Baixar modelo CSV
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xlsb,.xls"
          className="input-base"
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f) }}
        />

        <label className="flex items-center gap-2 cursor-pointer text-sm text-text-primary">
          <input
            type="checkbox"
            className="w-4 h-4 accent-primary"
            checked={createMissing}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.checked
              setCreateMissing(next)
              setPreview(null)
              if (file && !mappingIncomplete && (preview || !sheets.length)) validate(next)
            }}
          />
          Criar marcas, categorias e tratamentos que não existem
        </label>

        {sheets.length > 0 && (
          <div>
            <p className="text-sm font-medium text-text-primary mb-2">
              Abas com produtos — escolha quais importar e para qual marca e categoria
            </p>
            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="text-left text-xs text-text-secondary">
                    <th className="w-8 p-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary"
                        aria-label="Selecionar todas as abas"
                        checked={selectedSheets.length === sheets.length}
                        onChange={(e) => {
                          const selected = e.target.checked
                          setPreview(null)
                          setSheets((rows) => rows.map((s) => ({ ...s, selected })))
                        }}
                      />
                    </th>
                    <th className="p-2">Aba</th>
                    <th className="p-2 text-right">Produtos</th>
                    <th className="p-2 w-40">Marca</th>
                    <th className="p-2 w-52">Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.map((s) => (
                    <tr key={s.name} className="border-t border-border align-top">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-primary"
                          aria-label={`Importar aba ${s.name}`}
                          checked={s.selected}
                          onChange={(e) => updateSheet(s.name, { selected: e.target.checked })}
                        />
                      </td>
                      <td className="p-2">
                        <p className="font-medium text-text-primary">{s.name}</p>
                        <p className="text-xs text-text-placeholder">{s.treatments.join(', ') || 'Sem tratamentos'}</p>
                        {s.conflicts > 0 && (
                          <p className="text-xs text-warning">{s.conflicts} código(s) com preço diferente de outra aba</p>
                        )}
                      </td>
                      <td className="p-2 text-right">{s.products}</td>
                      <td className="p-2">
                        <input
                          className="input-base !px-2 !py-1.5 text-sm"
                          list="import-brands"
                          aria-label={`Marca da aba ${s.name}`}
                          value={s.brand}
                          disabled={!s.selected}
                          onChange={(e) => updateSheet(s.name, { brand: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          className="input-base !px-2 !py-1.5 text-sm"
                          aria-label={`Categoria da aba ${s.name}`}
                          value={s.category}
                          disabled={!s.selected}
                          onChange={(e) => updateSheet(s.name, { category: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <datalist id="import-brands">
              {brands.map((b) => <option key={b.id} value={b.name} />)}
            </datalist>
            <button
              type="button"
              onClick={() => validate()}
              disabled={busy || mappingIncomplete}
              className="btn-secondary w-full mt-3"
            >
              Validar abas selecionadas
            </button>
          </div>
        )}

        {busy && <p className="text-sm text-text-secondary">Processando...</p>}

        {preview && (
          <div className="rounded-md border border-border p-3 text-sm space-y-2">
            <p>
              <strong>{preview.total}</strong> produto(s) no arquivo
              {!hasErrors && <> — <strong>{preview.created}</strong> a criar, <strong>{preview.updated}</strong> a atualizar</>}
            </p>
            {preview.treatmentColumns.length > 0 && (
              <p className="text-text-secondary">Tratamentos: {preview.treatmentColumns.join(', ')}</p>
            )}
            {newRecords > 0 && (
              <div className="text-text-secondary">
                <p className="font-medium text-text-primary">Novos cadastros:</p>
                {preview.newBrands.length > 0 && <p>Marcas: {preview.newBrands.join(', ')}</p>}
                {preview.newCategories.length > 0 && <p>Categorias: {preview.newCategories.join(', ')}</p>}
                {preview.newTreatments.length > 0 && <p>Tratamentos: {preview.newTreatments.join(', ')}</p>}
              </div>
            )}
            {preview.configuredCategories.length > 0 && (
              <p className="text-text-secondary">
                {preview.configuredCategories.length} categoria(s) sem colunas configuradas vão usar os tratamentos da planilha.
              </p>
            )}
            {preview.warnings.length > 0 && (
              <div>
                <p className="text-warning font-medium mb-1">{preview.warnings.length} aviso(s) — confira antes de importar:</p>
                <ul className="max-h-32 overflow-y-auto text-xs space-y-0.5">
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            {hasErrors && (
              <div>
                <p className="text-danger font-medium mb-1">{preview.errors.length} erro(s) — corrija e envie novamente:</p>
                <ul className="max-h-60 overflow-y-auto text-xs space-y-0.5">
                  {preview.errors.map((err, i) => (
                    <li key={i}>
                      <span className="font-mono">{err.sheet ? `${err.sheet}, linha ${err.line}` : `Linha ${err.line}`}</span>
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
            {busy ? 'Processando...' : 'Importar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
