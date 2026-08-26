import { useLocation } from 'react-router-dom'
import { AppRoutes } from './router'
import { ThemeToggle } from './components/ThemeToggle'

function App() {
  const { pathname } = useLocation()
  // The explorer route renders its own single header row and needs the full
  // viewport width for GraphicWalker's canvas — App's shared chrome and
  // 768px max-w-3xl cap would make it unusable, not just cramped.
  const isExplorerRoute = pathname.startsWith('/enquesta/')

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased font-sans dark:bg-zinc-950 dark:text-zinc-100">
      {!isExplorerRoute && (
        <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
          <h1 className="text-lg font-semibold">Enquestes</h1>
          <ThemeToggle />
        </header>
      )}
      <main className={isExplorerRoute ? undefined : 'mx-auto max-w-3xl px-6 py-8'}>
        <AppRoutes />
      </main>
    </div>
  )
}

export default App
