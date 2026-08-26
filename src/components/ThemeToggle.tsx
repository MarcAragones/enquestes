import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Canvia a mode clar' : 'Canvia a mode fosc'}
      className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-accent hover:text-accent dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-accent-soft dark:hover:text-accent-soft"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}
