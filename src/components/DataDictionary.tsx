import type { EnquestaMetaField } from '../types/enquesta'

export interface DataDictionaryProps {
  fields: EnquestaMetaField[] | undefined
}

const TYPE_LABELS: Record<EnquestaMetaField['type'], string> = {
  dimension: 'dimensió',
  measure: 'mesura',
}

/**
 * Collapsed-by-default panel explaining every field in meta.json (EXPL-09).
 * Uses a native <details>/<summary> element for the collapse behaviour — no
 * React state, no custom disclosure widget; the platform already supplies
 * keyboard operability and expanded/collapsed semantics for free. Lives
 * outside GraphicWalker's own chrome entirely (D-06) — a sibling panel, not
 * tooltips injected into GraphicWalker's internal field list.
 */
export function DataDictionary({ fields }: DataDictionaryProps) {
  const count = fields?.length ?? 0

  return (
    <details className="mx-6 mt-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer text-base font-semibold">
        Diccionari de dades ({count})
      </summary>
      {count === 0 ? (
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          Aquesta enquesta no té camps documentats.
        </p>
      ) : (
        <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
          {fields?.map((field) => (
            <div
              key={field.name}
              className="border-b border-zinc-100 pb-2 last:border-b-0 dark:border-zinc-800/60"
            >
              <p className="text-base font-semibold">{field.label ?? field.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{TYPE_LABELS[field.type]}</p>
              {field.description && (
                <p className="text-sm break-words text-zinc-700 dark:text-zinc-300">
                  {field.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </details>
  )
}
