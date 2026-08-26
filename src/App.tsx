import { AppRoutes } from './router'
import { ThemeToggle } from './components/ThemeToggle'

function App() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased font-sans dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">Enquestes</h1>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <AppRoutes />
      </main>
    </div>
  )
}

export default App
