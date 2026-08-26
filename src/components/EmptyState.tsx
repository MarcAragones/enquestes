import { Inbox } from 'lucide-react'

/**
 * Genuinely-empty-catalog state — calm and neutral, visually distinct from
 * ErrorState. Shown when the fetch succeeds but the index array is empty.
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
      <Inbox className="h-8 w-8 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        Encara no hi ha cap enquesta publicada
      </p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Quan es publiqui la primera enquesta, apareixerà aquí.
      </p>
    </div>
  )
}
