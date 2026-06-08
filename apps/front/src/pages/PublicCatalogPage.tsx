import { useState, useEffect, useMemo, CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { publicService } from '../services/public.service'
import type { Catalog, CatalogWithProducts, Product, ColumnVisibility } from '../types'

// ── Helpers ────────────────────────────────────────────────────────────

function formatPrice(val: number | null | undefined): string {
  if (val == null) return '—'
  return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState<T>(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return dv
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

function groupByBrand(catalogs: Catalog[]) {
  const map = new Map<string, { brand: Catalog['brand']; catalogs: Catalog[] }>()
  for (const c of catalogs) {
    if (!map.has(c.brand.id)) map.set(c.brand.id, { brand: c.brand, catalogs: [] })
    map.get(c.brand.id)!.catalogs.push(c)
  }
  return map
}

// ── Table styles ───────────────────────────────────────────────────────

const TH: CSSProperties = {
  padding: '9px 10px',
  backgroundColor: '#F5F7FA',
  color: '#374151',
  fontWeight: 700,
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  textAlign: 'center',
  borderBottom: '2px solid #E5E7EB',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 1,
}

const TD: CSSProperties = {
  padding: '9px 10px',
  color: '#374151',
  borderBottom: '1px solid #F3F4F6',
  whiteSpace: 'nowrap',
  fontSize: '13px',
}

// ── ProductTable ───────────────────────────────────────────────────────

function ProductTable({
  products,
  allTreatmentNames,
  visibleColumns,
}: {
  products: Product[]
  allTreatmentNames: string[]
  visibleColumns?: ColumnVisibility | null
}) {
  const cols = resolveColumns(visibleColumns)

  const fixedColCount =
    1 + // cod
    1 + // material
    (cols.spherical ? 1 : 0) +
    (cols.cylindrical ? 1 : 0) +
    (cols.diameter ? 1 : 0) +
    (cols.addition ? 1 : 0) +
    (cols.priceNoAR ? 1 : 0) +
    (cols.availability ? 1 : 0)

  if (products.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ ...TH, textAlign: 'left' }}>Cod. WEB</th>
            <th style={{ ...TH, textAlign: 'left', minWidth: '160px' }}>Material</th>
            {cols.spherical   && <th style={{ ...TH, minWidth: '130px' }}>Esférico</th>}
            {cols.cylindrical && <th style={TH}>Cil</th>}
            {cols.diameter    && <th style={TH}>Ø</th>}
            {cols.addition    && <th style={{ ...TH, minWidth: '85px' }}>Adição</th>}
            {cols.priceNoAR   && <th style={{ ...TH, textAlign: 'right' }}>Sem AR</th>}
            {cols.availability && <th style={TH}>Disponib.</th>}
            {allTreatmentNames.length > 0 && (
              <th
                colSpan={allTreatmentNames.length}
                style={{
                  ...TH,
                  backgroundColor: '#54A7D9',
                  color: '#fff',
                  textAlign: 'center',
                  borderLeft: '2px solid rgba(255,255,255,0.35)',
                  letterSpacing: '0.08em',
                }}
              >
                Com Antirreflexo (AR)
              </th>
            )}
          </tr>
          {allTreatmentNames.length > 0 && (
            <tr>
              <td colSpan={fixedColCount} style={{ padding: 0, border: 'none', backgroundColor: '#F5F7FA' }} />
              {allTreatmentNames.map(name => (
                <th
                  key={name}
                  style={{
                    ...TH,
                    textAlign: 'right',
                    backgroundColor: 'rgba(84,167,217,0.08)',
                    borderLeft: '1px solid rgba(84,167,217,0.25)',
                    color: '#1a3a52',
                  }}
                >
                  {name}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {products.map((p, idx) => {
            const priceMap = Object.fromEntries(p.treatments.map(t => [t.treatment.name, t.price]))
            return (
              <tr key={p.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                <td style={{ ...TD, fontFamily: '"Courier New", monospace', fontWeight: 700, color: '#1a3a52', fontSize: '12px' }}>
                  {p.code}
                </td>
                <td style={{ ...TD, fontWeight: 500, color: '#111827' }}>{p.name}</td>
                {cols.spherical   && <td style={{ ...TD, color: '#6B7280' }}>{p.spherical   ?? '—'}</td>}
                {cols.cylindrical && <td style={{ ...TD, textAlign: 'center', color: '#6B7280' }}>{p.cylindrical ?? '—'}</td>}
                {cols.diameter    && <td style={{ ...TD, textAlign: 'center', color: '#6B7280' }}>{p.diameter    ?? '—'}</td>}
                {cols.addition    && <td style={{ ...TD, color: '#6B7280' }}>{p.addition    ?? '—'}</td>}
                {cols.priceNoAR   && (
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: p.priceNoAR != null ? '#111827' : '#D1D5DB' }}>
                    {formatPrice(p.priceNoAR)}
                  </td>
                )}
                {cols.availability && (
                  <td style={{ ...TD, textAlign: 'center', color: '#6B7280', fontSize: '12px' }}>{p.availability ?? '—'}</td>
                )}
                {allTreatmentNames.map(name => (
                  <td
                    key={name}
                    style={{
                      ...TD,
                      textAlign: 'right',
                      borderLeft: '1px solid rgba(84,167,217,0.15)',
                      fontWeight: priceMap[name] != null ? 600 : 400,
                      color: priceMap[name] != null ? '#111827' : '#D1D5DB',
                    }}
                  >
                    {priceMap[name] != null ? formatPrice(priceMap[name]) : '—'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────

function Spinner({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '50%',
        border: `${size > 20 ? 3 : 2}px solid #54A7D9`,
        borderTopColor: 'transparent',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  )
}

// ── PublicCatalogPage ──────────────────────────────────────────────────

export function PublicCatalogPage() {
  const { catalogId } = useParams<{ catalogId?: string }>()
  const navigate = useNavigate()

  const [catalogs, setCatalogs]             = useState<Catalog[]>([])
  const [selected, setSelected]             = useState<CatalogWithProducts | null>(null)
  const [loadingList, setLoadingList]       = useState(true)
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [search, setSearch]                 = useState('')
  const [sidebarOpen, setSidebarOpen]       = useState(false)

  const debouncedSearch = useDebounce(search, 400)

  // Carregar lista de catálogos ao montar
  useEffect(() => {
    publicService.listCatalogs()
      .then(data => {
        setCatalogs(data)
        if (!catalogId && data.length > 0) navigate(`/c/${data[0].id}`, { replace: true })
      })
      .finally(() => setLoadingList(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Carregar catálogo selecionado quando ID ou busca mudar
  useEffect(() => {
    if (!catalogId) return
    setLoadingCatalog(true)
    publicService.getCatalog(catalogId, debouncedSearch || undefined)
      .then(setSelected)
      .catch(() => setSelected(null))
      .finally(() => setLoadingCatalog(false))
  }, [catalogId, debouncedSearch])

  const brandGroups = useMemo(() => groupByBrand(catalogs), [catalogs])

  // Coletar todos os tratamentos do catálogo atual (para manter colunas estáveis entre seções)
  const allTreatmentNames = useMemo(() =>
    selected
      ? Array.from(new Set(selected.products.flatMap(p => p.treatments.map(t => t.treatment.name)))).sort()
      : []
  , [selected])

  // Organizar produtos por seção
  const sections = useMemo(() => {
    if (!selected) return []
    const { sections: secs, products } = selected

    if (!secs?.length) return [{ id: '__all', title: '', headerImage: null as string | null, products }]

    return secs
      .map(sec => ({
        ...sec,
        products: sec.productIds
          .map(pid => products.find(p => p.id === pid))
          .filter(Boolean) as Product[],
      }))
      .filter(sec => sec.products.length > 0)
  }, [selected])

  const totalVisible = sections.reduce((acc, s) => acc + s.products.length, 0)

  if (loadingList) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div className="flex flex-col items-center gap-3">
          <Spinner size={40} />
          <p className="text-sm text-text-secondary">Carregando catálogo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .catalog-row:hover { background-color: #EFF6FF !important; }
      `}</style>

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-4 h-14"
        style={{ backgroundColor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-2.5">
          {/* Hamburger — mobile */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-text-secondary transition-colors"
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#54A7D9' }}>
              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12z"/>
              </svg>
            </div>
            <span className="font-bold text-text-primary text-base">Unilentes</span>
          </div>
        </div>

        <a
          href="/login"
          className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          Entrar
        </a>
      </header>

      <div className="flex flex-1" style={{ maxWidth: '100%' }}>
        {/* ── Sidebar overlay — mobile ─────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 lg:hidden"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ─────────────────────────────────────────────── */}
        <aside
          className="fixed lg:sticky top-14 z-40 lg:z-auto flex-shrink-0"
          style={{
            width: '240px',
            height: 'calc(100vh - 3.5rem)',
            backgroundColor: '#fff',
            borderRight: '1px solid #E5E7EB',
            overflowY: 'auto',
            transform: sidebarOpen ? 'translateX(0)' : undefined,
            transition: 'transform 0.2s ease',
          }}
          // On large screens always visible; on mobile controlled by sidebarOpen
          hidden={undefined}
        >
          <div className="p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest px-2 mb-3 mt-1" style={{ color: '#9CA3AF' }}>
              Tabelas de Preços
            </p>

            {Array.from(brandGroups.values()).map(group => (
              <div key={group.brand.id} className="mb-4">
                <div className="flex items-center gap-2 px-2 py-1">
                  {group.brand.logoUrl ? (
                    <img src={group.brand.logoUrl} alt={group.brand.name} className="w-4 h-4 object-contain" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#54A7D9' }} />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                    {group.brand.name}
                  </span>
                </div>

                <div className="ml-2 space-y-0.5">
                  {group.catalogs.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => { navigate(`/c/${cat.id}`); setSearch(''); setSidebarOpen(false) }}
                      className="w-full text-left px-2 py-2 rounded-lg text-xs transition-all leading-snug"
                      style={{
                        backgroundColor: catalogId === cat.id ? 'rgba(84,167,217,0.1)' : 'transparent',
                        color: catalogId === cat.id ? '#1a3a52' : '#6B7280',
                        fontWeight: catalogId === cat.id ? 600 : 400,
                      }}
                    >
                      <div>{cat.title}</div>
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: '#9CA3AF' }}>{cat.category.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 pb-16" style={{ marginLeft: sidebarOpen ? 0 : undefined }}>

          {/* Mobile: hide sidebar spacer */}
          <div className="lg:hidden" style={{ marginLeft: sidebarOpen ? '240px' : 0, transition: 'margin 0.2s' }} />

          {catalogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-text-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
              <h2 className="mt-4 text-lg font-semibold text-text-secondary">Nenhum catálogo disponível</h2>
              <p className="text-sm mt-1">Entre em contato para mais informações.</p>
            </div>
          ) : (
            <>
              {/* Hero */}
              {selected && (
                <div
                  className="relative overflow-hidden flex items-end"
                  style={{ minHeight: '180px', background: 'linear-gradient(135deg, #1a3a52 0%, #2d6e9e 60%, #54A7D9 100%)' }}
                >
                  {selected.headerImage && (
                    <img
                      src={selected.headerImage}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ opacity: 0.18 }}
                    />
                  )}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(26,58,82,0.9) 0%, rgba(26,58,82,0.3) 100%)' }} />

                  <div className="relative z-10 p-6 flex items-end justify-between gap-6 w-full" style={{ minHeight: '180px' }}>
                    <div className="flex-1 min-w-0">
                      {selected.badge && (
                        <span
                          className="inline-block mb-2 px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider"
                          style={{ backgroundColor: '#54A7D9', color: '#fff', boxShadow: '0 0 0 2px rgba(255,255,255,0.25)' }}
                        >
                          {selected.badge}
                        </span>
                      )}
                      <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {selected.brand.name} · {selected.category.name}
                      </p>
                      <h1 className="text-2xl font-bold text-white leading-tight truncate">{selected.title}</h1>
                      {selected.subtitle && (
                        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{selected.subtitle}</p>
                      )}
                    </div>

                    {selected.crmUrl && (
                      <a
                        href={selected.crmUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 flex-shrink-0"
                        style={{ backgroundColor: '#54A7D9', padding: '10px 20px', boxShadow: '0 4px 16px rgba(84,167,217,0.5)' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                        </svg>
                        Fazer Pedido
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Search bar */}
              {selected && (
                <div
                  className="sticky z-10 px-4 py-3"
                  style={{ top: '3.5rem', backgroundColor: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #E5E7EB' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: '#9CA3AF' }}
                        width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      >
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por Código WEB, nome ou material..."
                        className="w-full py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 placeholder-text-placeholder"
                        style={{
                          paddingLeft: '2.25rem',
                          paddingRight: search ? '2.25rem' : '0.75rem',
                          borderColor: '#E5E7EB',
                        }}
                      />
                      {search && (
                        <button
                          onClick={() => setSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                          style={{ color: '#9CA3AF' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    {search && !loadingCatalog && (
                      <span className="text-xs whitespace-nowrap" style={{ color: '#6B7280' }}>
                        {totalVisible} resultado{totalVisible !== 1 ? 's' : ''}
                      </span>
                    )}
                    {loadingCatalog && <Spinner size={18} />}
                  </div>
                </div>
              )}

              {/* Loading initial catalog */}
              {loadingCatalog && !selected && (
                <div className="flex items-center justify-center py-20">
                  <Spinner size={36} />
                </div>
              )}

              {/* Catalog content */}
              {selected && !loadingCatalog && (
                <div>
                  {sections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16" style={{ color: '#9CA3AF' }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <p className="mt-3 text-sm">Nenhum produto encontrado para "{search}"</p>
                      <button onClick={() => setSearch('')} className="mt-2 text-sm hover:underline" style={{ color: '#54A7D9' }}>
                        Limpar busca
                      </button>
                    </div>
                  ) : sections.map(sec => (
                    <div key={sec.id}>
                      {/* Section header */}
                      {sec.id !== '__all' && (
                        sec.headerImage ? (
                          <div className="relative overflow-hidden" style={{ height: '120px' }}>
                            <img src={sec.headerImage} alt={sec.title} className="w-full h-full object-cover" />
                            <div
                              className="absolute inset-0 flex items-center px-6"
                              style={{ background: 'rgba(26,58,82,0.72)' }}
                            >
                              <h2 className="text-lg font-bold text-white">{sec.title}</h2>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: '#1a3a52' }}>
                            <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: '#54A7D9' }} />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wide">{sec.title}</h2>
                          </div>
                        )
                      )}

                      {/* Products table */}
                      <div style={{ backgroundColor: '#fff' }}>
                        <ProductTable
                          products={sec.products}
                          allTreatmentNames={allTreatmentNames}
                          visibleColumns={selected.visibleColumns}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
