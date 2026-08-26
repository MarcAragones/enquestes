import { AlertTriangle } from 'lucide-react'

interface ErrorStateProps {
  message: string
  onRetry: () => void
}

/**
 * Explicit load-failure state (HOME-02) — clearly alarmed and visually
 * unmistakable against EmptyState, with a working retry control. A broken
 * deploy must never read the same as a genuinely empty catalog.
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-10 text-center dark:border-red-900 dark:bg-red-950/40"
    >
      <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" aria-hidden="true" />
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        No s'han pogut carregar les enquestes
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Torna-ho a provar
      </button>
    </div>
  )
}
