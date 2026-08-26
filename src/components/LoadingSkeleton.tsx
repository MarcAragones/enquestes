/**
 * Loading placeholder for the catalog. Matches SurveyGrid's grid geometry
 * exactly so the page doesn't jump when real cards replace the skeleton.
 */
export function LoadingSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Carregant enquestes…</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900"
        />
      ))}
    </div>
  )
}
