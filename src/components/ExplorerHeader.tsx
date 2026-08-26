import { Link } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

export interface ExplorerHeaderProps {
  title: string
}

/**
 * The explorer route's single compact header row: back-link, survey title,
 * dark-mode toggle. Matches App.tsx's homepage header class-for-class so the
 * explorer's chrome is visually indistinguishable from the homepage's.
 * Deliberately excludes the survey's date/description/participant count —
 * the visitor already saw those in SurveySummaryModal (D-02) — and reserves
 * no button here beyond ThemeToggle; Plan 03 adds Copy-link next to it.
 */
export function ExplorerHeader({ title }: ExplorerHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          to="/"
          className="shrink-0 text-accent hover:text-accent-strong"
        >
          ← Torna al llistat d'enquestes
        </Link>
        <h1 title={title} className="truncate text-lg font-semibold">
          {title}
        </h1>
      </div>
      <ThemeToggle />
    </header>
  )
}
