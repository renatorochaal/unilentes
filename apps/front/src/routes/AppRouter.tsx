import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '../contexts/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'
import { AppLayout } from '../components/layout/AppLayout'
import { LoginPage } from '../pages/LoginPage'
import { CatalogPage } from '../pages/CatalogPage'
import { PublicCatalogPage } from '../pages/PublicCatalogPage'
import { ProductsPage } from '../pages/ProductsPage'
import { BrandsPage } from '../pages/BrandsPage'
import { BrandDetailPage } from '../pages/BrandDetailPage'
import { SuppliersPage } from '../pages/SuppliersPage'
import { TreatmentsPage } from '../pages/TreatmentsPage'
import { ExportsPage } from '../pages/ExportsPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              borderRadius: '10px',
            },
          }}
        />
        <Routes>
          {/* Rota pública do catálogo — sem autenticação */}
          <Route path="/c" element={<PublicCatalogPage />} />
          <Route path="/c/:catalogId" element={<PublicCatalogPage />} />

          {/* Rota pública — redireciona se já logado */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          {/* Rotas protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/catalog" replace />} />
              <Route path="/catalog"    element={<CatalogPage />} />
              <Route path="/products"   element={<ProductsPage />} />
              <Route path="/brands"     element={<BrandsPage />} />
              <Route path="/brands/:id" element={<BrandDetailPage />} />
              <Route path="/suppliers"  element={<SuppliersPage />} />
              <Route path="/treatments" element={<TreatmentsPage />} />
              <Route path="/exports"    element={<ExportsPage />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
