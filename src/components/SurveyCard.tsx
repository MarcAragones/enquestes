import { formatCount, formatDate } from '../lib/enquestes'
import type { EnquestaIndexEntry } from '../types/enquesta'

interface SurveyCardProps {
  enquesta: EnquestaIndexEntry
  onSelect: (id: string) => void
}

/**
 * Text-only survey card (D-03) — title, date, description and participant
 * count only, nothing else. Rendered as a single button so the whole card
 * is one keyboard-focusable, Enter/Space-activatable target.
 */
export function SurveyCard({ enquesta, onSelect }: SurveyCardProps) {
  const participantsLabel = enquesta.n === 1 ? 'participant' : 'participants'

  return (
    <button
      type="button"
      onClick={() => onSelect(enquesta.id)}
      aria-label={`${enquesta.title} — ${formatCount(enquesta.n)} ${participantsLabel}`}
      className="w-full rounded-lg border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-accent-soft"
    >
      <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {formatDate(enquesta.date)}
      </p>
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{enquesta.title}</p>
      <p className="mt-2 text-sm text-zinc-600 line-clamp-3 dark:text-zinc-400">
        {enquesta.description}
      </p>
      <p className="mt-4 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
        {formatCount(enquesta.n)} {participantsLabel}
      </p>
    </button>
  )
}
