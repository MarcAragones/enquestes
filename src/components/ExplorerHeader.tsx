import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import type { CopyLinkOutcome } from '../lib/copyLink'

export interface ExplorerHeaderProps {
  title: string
  onCopyLink?: () => Promise<CopyLinkOutcome>
}

const COPIED_LABEL_DURATION_MS = 2000
// Failure messages need more time to read than the one-word success
// confirmation — the visitor has to actually read and act on the reason
// (simplify the chart, retry, etc.), not just glance at a checkmark.
const COPY_FAILURE_DURATION_MS = 6000

/** Owned entirely by this component — no toast/snackbar. */
type CopyFeedback = { kind: 'success' } | { kind: 'failure'; message: string } | null

/**
 * The explorer route's single compact header row: back-link, survey title,
 * dark-mode toggle. Matches App.tsx's homepage header class-for-class so the
 * explorer's chrome is visually indistinguishable from the homepage's.
 * Deliberately excludes the survey's date/description/participant count —
 * the visitor already saw those in SurveySummaryModal (D-02).
 *
 * When `onCopyLink` is supplied, renders a "Copia l'enllaç" button beside
 * `<ThemeToggle />` (D-06 — this control lives in the app-shell header, never
 * inside or beside GraphicWalker's own toolbar). A successful copy shows
 * "Copiat!" for two seconds; a failed copy (G-05-4) never shows the success
 * label — instead an `aria-live="polite"` `role="status"` message next to
 * the button explains why, for a longer duration.
 */
export function ExplorerHeader({ title, onCopyLink }: ExplorerHeaderProps) {
  const [feedback, setFeedback] = useState<CopyFeedback>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
  }, [])

  const handleClick = async () => {
    if (!onCopyLink) return
    // Reset before each new attempt so two clicks in a row can never leave
    // a stale message from the previous attempt on screen.
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    setFeedback(null)

    const outcome = await onCopyLink()
    if (outcome.ok) {
      setFeedback({ kind: 'success' })
      timerRef.current = setTimeout(() => setFeedback(null), COPIED_LABEL_DURATION_MS)
    } else {
      setFeedback({ kind: 'failure', message: outcome.message })
      timerRef.current = setTimeout(() => setFeedback(null), COPY_FAILURE_DURATION_MS)
    }
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
          <div className="flex items-center gap-3">
            {feedback?.kind === 'failure' && (
              <span role="status" aria-live="polite" className="max-w-xs text-sm text-red-600 dark:text-red-400">
                {feedback.message}
              </span>
            )}
            <button
              type="button"
              onClick={handleClick}
              className="flex items-center gap-1 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              {feedback?.kind === 'success' ? 'Copiat!' : "Copia l'enllaç"}
            </button>
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
