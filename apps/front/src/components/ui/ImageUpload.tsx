import { useRef, useState } from 'react'
import { api } from '../../services/api'
import toast from 'react-hot-toast'

interface ImageUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
  label?: string
  hint?: string
  /** Largura/altura do preview — default 80px */
  size?: number
  shape?: 'square' | 'circle'
  /** Quando true, renderiza só o preview clicável (sem botão/hint ao lado) */
  compact?: boolean
}

export function ImageUpload({
  value,
  onChange,
  label,
  hint = 'PNG, JPG ou SVG — máx. 3 MB',
  size = 80,
  shape = 'square',
  compact = false,
}: ImageUploadProps) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem.')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 3 MB.')
      return
    }

    setLoading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const { data } = await api.post<{ status: string; data: { url: string } }>(
        '/api/uploads/image',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      onChange(data.data.url)
    } catch {
      toast.error('Erro ao fazer upload da imagem.')
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-xl'

  const preview = (
    <div
      className={`relative flex-shrink-0 border-2 border-dashed border-border overflow-hidden bg-gray-50 transition-colors hover:border-primary/60 cursor-pointer ${rounded}`}
      style={{ width: size, height: size }}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      title="Clique ou arraste uma imagem"
    >
      {value ? (
        <img src={value} alt="Logo" className="w-full h-full object-contain p-1" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-text-placeholder">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          {!compact && <span className="text-[10px] font-medium">Logo</span>}
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div
            className="rounded-full border-2 border-primary border-t-transparent animate-spin"
            style={{ width: 24, height: 24 }}
          />
        </div>
      )}

      {/* Edit badge */}
      {value && !loading && (
        <div
          className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow"
          title="Trocar imagem"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
      )}

      {/* Remover — apenas no modo compacto, já que não há botão "Remover" ao lado */}
      {compact && value && !loading && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onChange(null) }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger flex items-center justify-center shadow"
          title="Remover imagem"
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  )

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={e => {
        const file = e.target.files?.[0]
        if (file) handleFile(file)
        e.target.value = ''
      }}
    />
  )

  if (compact) {
    return <div className="inline-block">{preview}{input}</div>
  }

  return (
    <div className="flex items-start gap-4">
      {preview}

      {/* Right side */}
      <div className="flex-1 min-w-0 pt-1">
        {label && <p className="label-base mb-1">{label}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            {loading ? 'Enviando...' : value ? 'Trocar imagem' : 'Selecionar imagem'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              disabled={loading}
              className="text-xs text-text-placeholder hover:text-danger transition-colors"
            >
              Remover
            </button>
          )}
        </div>
        <p className="text-[11px] text-text-placeholder mt-1.5">{hint}</p>
      </div>

      {input}
    </div>
  )
}
