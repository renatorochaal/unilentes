import { ImageUpload } from '../ui/ImageUpload'
import type { Brand } from '../../types'

export type ImagePagePosition = 'start' | 'end' | 'beforeBrand' | 'afterBrand'

export interface ImagePageDraft {
  key: string
  imageUrl: string | null
  position: ImagePagePosition
  brandId: string
}

const POSITION_LABEL: Record<ImagePagePosition, string> = {
  start:       'Início do PDF (capa)',
  beforeBrand: 'Antes da marca',
  afterBrand:  'Depois da marca',
  end:         'Final do PDF',
}

let keySeq = 0
export function newImagePageDraft(): ImagePageDraft {
  keySeq += 1
  return { key: `img-page-${keySeq}`, imageUrl: null, position: 'start', brandId: '' }
}

/** Retorna a mensagem do primeiro problema encontrado, ou null se tudo certo. */
export function validateImagePages(pages: ImagePageDraft[]): string | null {
  for (const [i, p] of pages.entries()) {
    if (!p.imageUrl) return `Página de imagem ${i + 1}: envie a imagem ou remova a página.`
    if ((p.position === 'beforeBrand' || p.position === 'afterBrand') && !p.brandId) {
      return `Página de imagem ${i + 1}: selecione a marca.`
    }
  }
  return null
}

interface ImagePagesEditorProps {
  pages: ImagePageDraft[]
  onChange: (pages: ImagePageDraft[]) => void
  brands: Brand[]
}

/**
 * Páginas A4 inteiras com imagem (capa, apresentação de linha, tabela de
 * disponibilidade...). Páginas na mesma posição saem na ordem da lista.
 */
export function ImagePagesEditor({ pages, onChange, brands }: ImagePagesEditorProps) {
  function update(key: string, patch: Partial<ImagePageDraft>) {
    onChange(pages.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }
  function move(idx: number, delta: number) {
    const target = idx + delta
    if (target < 0 || target >= pages.length) return
    const next = [...pages]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      {pages.map((page, idx) => {
        const needsBrand = page.position === 'beforeBrand' || page.position === 'afterBrand'
        return (
          <div key={page.key} className="flex gap-3 items-start rounded-lg border border-border p-3">
            <ImageUpload
              value={page.imageUrl}
              onChange={(url) => update(page.key, { imageUrl: url })}
              maxSizeMB={10}
              size={64}
              compact
            />
            <div className="flex-1 space-y-2">
              <select
                className="input-base"
                value={page.position}
                onChange={(e) => update(page.key, { position: e.target.value as ImagePagePosition })}
              >
                {(Object.keys(POSITION_LABEL) as ImagePagePosition[]).map((pos) => (
                  <option key={pos} value={pos}>{POSITION_LABEL[pos]}</option>
                ))}
              </select>
              {needsBrand && (
                <select
                  className="input-base"
                  value={page.brandId}
                  onChange={(e) => update(page.key, { brandId: e.target.value })}
                >
                  <option value="">Selecione a marca</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-col">
              <button type="button" className="btn-ghost p-1 disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)} title="Subir">↑</button>
              <button type="button" className="btn-ghost p-1 disabled:opacity-30" disabled={idx === pages.length - 1} onClick={() => move(idx, 1)} title="Descer">↓</button>
              <button type="button" className="btn-ghost p-1 hover:text-danger" onClick={() => onChange(pages.filter((p) => p.key !== page.key))} title="Remover">✕</button>
            </div>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => onChange([...pages, newImagePageDraft()])}
        className="text-xs text-primary hover:text-primary-600 font-medium"
      >
        + Adicionar página de imagem
      </button>
    </div>
  )
}
