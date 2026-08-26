import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'

const ExplorerPage = lazy(() => import('./pages/ExplorerPage'))

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/enquesta/:id"
        element={
          <Suspense fallback={<p>Carregant…</p>}>
            <ExplorerPage />
          </Suspense>
        }
      />
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}
