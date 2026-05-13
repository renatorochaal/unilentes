import { useState, useEffect } from 'react'
import { catalogService } from '../services/catalog.service'
import { productService } from '../services/product.service'
import { PageLoader } from '../components/ui/LoadingSpinner'
import type { Catalog, Product } from '../types'

export function CatalogPage() {
  const [catalogs, setCatalogs] = useState<Catalog[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Catalog | null>(null)

  useEffect(() => {
    catalogService.list()
      .then((data) => {
        setCatalogs(data)
        if (data.length > 0) setSelected(data[0])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  if (catalogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-text-placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <h2 className="mt-4 text-lg font-semibold text-text-primary">Nenhum catálogo disponível</h2>
        <p className="text-sm mt-1">Cadastre marcas e categorias para criar catálogos de preços.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catálogo de Preços</h1>
          <p className="text-sm text-text-secondary mt-0.5">Tabelas de lentes por marca e categoria</p>
        </div>
      </div>

      {/* Catalog selector */}
      <div className="flex gap-2 flex-wrap mb-6">
        {catalogs.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selected?.id === c.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface border border-border text-text-secondary hover:text-text-primary hover:border-primary/50'
            }`}
          >
            {c.brand.name} — {c.category.name}
          </button>
        ))}
      </div>

      {selected && <CatalogView catalog={selected} />}
    </div>
  )
}

function CatalogView({ catalog }: { catalog: Catalog }) {
  return (
    <div className="card overflow-hidden">
      {/* Hero Banner */}
      <div className="relative h-48 bg-gradient-to-r from-primary-800 to-primary-500 flex items-end p-6 overflow-hidden">
        {catalog.headerImage && (
          <img
            src={catalog.headerImage}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/80 to-transparent" />
        <div className="relative z-10">
          {catalog.badge && (
            <span className="inline-block mb-2 px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold rounded-full uppercase tracking-wide">
              {catalog.badge}
            </span>
          )}
          <div className="text-xs font-semibold text-primary-200 uppercase tracking-widest mb-1">
            {catalog.brand.name}
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">{catalog.title}</h2>
          {catalog.subtitle && (
            <p className="text-primary-100 text-sm mt-1">{catalog.subtitle}</p>
          )}
        </div>
      </div>

      {/* Table placeholder — produtos virão de /products filtrado por brand + category */}
      <div className="p-6">
        <p className="text-sm text-text-secondary">
          Exibindo tabela de preços para{' '}
          <strong className="text-text-primary">{catalog.brand.name}</strong> /{' '}
          <strong className="text-text-primary">{catalog.category.name}</strong>
        </p>
        {catalog.description && (
          <p className="mt-2 text-sm text-text-secondary">{catalog.description}</p>
        )}
      </div>

      <CatalogProductTable brandId={catalog.brandId} categoryId={catalog.categoryId} />
    </div>
  )
}

function CatalogProductTable({ brandId, categoryId }: { brandId: string; categoryId: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    productService.list({ brand: brandId, category: categoryId, limit: 200, isActive: true })
      .then((r) => setProducts(r.data))
      .finally(() => setLoading(false))
  }, [brandId, categoryId])


  if (loading) return <div className="p-6"><PageLoader /></div>

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-text-placeholder text-sm">
        Nenhum produto ativo nesta categoria.
      </div>
    )
  }

  // Coletar todos os tratamentos únicos
  const treatmentNames = Array.from(
    new Set(products.flatMap((p) => p.treatments.map((t) => t.treatment.name)))
  ).sort()

  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Cod.</th>
            <th>Material</th>
            <th>Disponib.</th>
            <th>Cil</th>
            <th>Ø</th>
            <th>Ad.</th>
            <th className="text-right">Sem AR</th>
            {treatmentNames.length > 0 && (
              <th
                colSpan={treatmentNames.length}
                className="text-center bg-primary-50 text-primary-700 border-l border-primary-200"
              >
                Com Antirreflexo (AR)
              </th>
            )}
          </tr>
          {treatmentNames.length > 0 && (
            <tr>
              <th colSpan={7} />
              {treatmentNames.map((name) => (
                <th
                  key={name}
                  className="text-right bg-primary-50/60 text-primary-600 border-l border-primary-200/50"
                >
                  {name}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {products.map((p) => {
            const priceMap = Object.fromEntries(p.treatments.map((t) => [t.treatment.name, t.price]))
            return (
              <tr key={p.id}>
                <td className="font-mono text-xs font-semibold">{p.code}</td>
                <td className="font-medium">{p.name}</td>
                <td className="text-xs text-text-secondary">{p.availability ?? '—'}</td>
                <td className="text-xs text-text-secondary">{p.cylindrical ?? '—'}</td>
                <td className="text-xs text-text-secondary">{p.diameter ?? '—'}</td>
                <td className="text-xs text-text-secondary">{p.addition ?? '—'}</td>
                <td className="text-right font-medium">
                  {p.priceNoAR != null ? `R$ ${Number(p.priceNoAR).toFixed(2)}` : '—'}
                </td>
                {treatmentNames.map((name) => (
                  <td key={name} className="text-right border-l border-primary-100">
                    {priceMap[name] != null
                      ? `R$ ${Number(priceMap[name]).toFixed(2)}`
                      : '—'}
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
