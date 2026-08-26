import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export interface ExplorerHeaderProps {
  title: string
  onCopyLink?: () => void | Promise<void>
}

const COPIED_LABEL_DURATION_MS = 2000

/**
 * The explorer route's single compact header row: back-link, survey title,
 * dark-mode toggle. Matches App.tsx's homepage header class-for-class so the
 * explorer's chrome is visually indistinguishable from the homepage's.
 * Deliberately excludes the survey's date/description/participant count —
 * the visitor already saw those in SurveySummaryModal (D-02).
 *
 * When `onCopyLink` is supplied, renders a "Copia l'enllaç" button beside
 * `<ThemeToggle />` (D-06 — this control lives in the app-shell header, never
 * inside or beside GraphicWalker's own toolbar). The confirmation state
 * ("Copiat!" for two seconds) is owned entirely here — no toast/snackbar.
 */
export function ExplorerHeader({ title, onCopyLink }: ExplorerHeaderProps) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  const handleClick = async () => {
    if (!onCopyLink) return
    await onCopyLink()
    setCopied(true)
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), COPIED_LABEL_DURATION_MS)
  }

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
      <div className="flex shrink-0 items-center gap-4">
        {onCopyLink && (
          <button
            type="button"
            onClick={handleClick}
            className="flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? 'Copiat!' : "Copia l'enllaç"}
          </button>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
