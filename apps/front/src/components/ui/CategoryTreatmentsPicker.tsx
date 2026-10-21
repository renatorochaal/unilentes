import type { Treatment } from '../../types'

interface CategoryTreatmentsPickerProps {
  /** IDs selecionados, na ordem das colunas */
  value: string[]
  onChange: (ids: string[]) => void
  treatments: Treatment[]
}

/** Seleção ordenada das colunas de tratamento (AR) exibidas nas tabelas da categoria. */
export function CategoryTreatmentsPicker({ value, onChange, treatments }: CategoryTreatmentsPickerProps) {
  const byId = new Map(treatments.map((t) => [t.id, t]))
  const available = treatments.filter((t) => !value.includes(t.id))

  function move(idx: number, delta: number) {
    const target = idx + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  return (
    <div>
      <label className="label-base">Colunas de tratamento (AR)</label>
      <p className="text-[11px] text-text-placeholder mb-2">
        Define quais tratamentos aparecem nas tabelas e no PDF desta categoria, nesta ordem.
        Sem nenhum selecionado, aparecem só os que têm preço em algum produto.
      </p>
      {value.length > 0 && (
        <ol className="space-y-1 mb-2">
          {value.map((id, idx) => (
            <li key={id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
              <span className="w-5 text-text-placeholder text-xs">{idx + 1}.</span>
              <span className="flex-1 text-text-primary">{byId.get(id)?.name ?? 'Tratamento removido'}</span>
              <button type="button" className="btn-ghost p-1 disabled:opacity-30" disabled={idx === 0} onClick={() => move(idx, -1)} title="Subir">↑</button>
              <button type="button" className="btn-ghost p-1 disabled:opacity-30" disabled={idx === value.length - 1} onClick={() => move(idx, 1)} title="Descer">↓</button>
              <button type="button" className="btn-ghost p-1 hover:text-danger" onClick={() => onChange(value.filter((v) => v !== id))} title="Remover">✕</button>
            </li>
          ))}
        </ol>
      )}
      <select
        className="input-base"
        value=""
        onChange={(e) => { if (e.target.value) onChange([...value, e.target.value]) }}
        disabled={available.length === 0}
      >
        <option value="">{available.length ? '+ Adicionar tratamento' : 'Todos os tratamentos adicionados'}</option>
        {available.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  )
}
