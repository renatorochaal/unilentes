import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthContext'
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'
import { AppLayout } from '../components/layout/AppLayout'
import { LoginPage } from '../pages/LoginPage'
import { CatalogPage } from '../pages/CatalogPage'
import { ProductsPage } from '../pages/ProductsPage'
import { BrandsPage } from '../pages/BrandsPage'
import { CategoriesPage } from '../pages/CategoriesPage'
import { SuppliersPage } from '../pages/SuppliersPage'
import { TreatmentsPage } from '../pages/TreatmentsPage'
import { ExportsPage } from '../pages/ExportsPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
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
              <Route path="/categories" element={<CategoriesPage />} />
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
