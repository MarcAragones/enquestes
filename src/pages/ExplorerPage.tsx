import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { GraphicWalker } from '@kanaries/graphic-walker'
import '@kanaries/graphic-walker/dist/style.css'
import { isValidEnquestaId, metaUrl, parseEnquestaMeta } from '../lib/enquestes'
import { toGraphicWalkerFields } from '../lib/graphicWalkerFields'
import { getDb, queryParquet } from '../services/duckdb'
import { ErrorState } from '../components/ErrorState'
import { ExplorerHeader } from '../components/ExplorerHeader'
import { DataDictionary } from '../components/DataDictionary'
import { useTheme } from '../hooks/useTheme'
import type { EnquestaMeta, FetchState } from '../types/enquesta'

interface ExplorerData {
  meta: EnquestaMeta
  rows: Record<string, unknown>[]
}

/** aria-busy + sr-only status text + animate-pulse, matching LoadingSkeleton's conventions. */
function LoadingBlock({ text }: { text: string }) {
  return (
    <div aria-busy="true" className="flex min-h-96 items-center justify-center">
      <span className="sr-only">{text}</span>
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <p aria-hidden="true" className="text-sm text-zinc-500 dark:text-zinc-400">
          {text}
        </p>
      </div>
    </div>
  )
}

export default function ExplorerPage() {
  const { id } = useParams<{ id: string }>()
  const valid = id !== undefined && isValidEnquestaId(id)
  const { theme } = useTheme()

  const [engineState, setEngineState] = useState<FetchState<true>>({ status: 'loading' })
  const [dataState, setDataState] = useState<FetchState<ExplorerData>>({ status: 'loading' })
  const [dataAttempt, setDataAttempt] = useState(0)

  // Phase 1: DuckDB-Wasm engine init. Failure here is not retry-recoverable
  // — a different browser/environment is needed, so there is no attempt
  // counter and no retry action for this phase.
  useEffect(() => {
    if (!valid) return
    let cancelled = false

    getDb()
      .then(() => {
        if (!cancelled) setEngineState({ status: 'success', data: true })
      })
      .catch(() => {
        if (!cancelled) setEngineState({ status: 'error', message: '' })
      })

    return () => {
      cancelled = true
    }
  }, [valid])

  // Phase 2: meta.json + Parquet, only once phase 1 succeeded. Plausibly
  // transient (network blip), so this phase offers a retry.
  useEffect(() => {
    if (!valid || id === undefined || engineState.status !== 'success') return
    let cancelled = false

    Promise.all([
      fetch(metaUrl(id)).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      }),
      queryParquet(id),
    ])
      .then(([metaBody, rows]) => {
        const meta = parseEnquestaMeta(metaBody)
        if (!cancelled) setDataState({ status: 'success', data: { meta, rows } })
      })
      .catch(() => {
        if (!cancelled) {
          setDataState({
            status: 'error',
            message: "No s'han pogut carregar les dades de l'enquesta.",
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [valid, id, engineState.status, dataAttempt])

  const onDataRetry = () => {
    setDataState({ status: 'loading' })
    setDataAttempt((a) => a + 1)
  }

  // The header always renders, in every page state (EXPL-07): the survey id
  // stands in for the title until meta.json resolves (never an empty
  // string, never a disappearing/reappearing header), then the real title
  // takes over once the phase-2 load succeeds.
  let headerTitle = id ?? 'Enquesta'
  let content
  if (!valid) {
    content = <p className="text-zinc-700 dark:text-zinc-300">No s'ha trobat aquesta enquesta.</p>
  } else if (engineState.status === 'loading') {
    content = <LoadingBlock text="Inicialitzant el motor de consultes…" />
  } else if (engineState.status === 'error') {
    content = (
      <ErrorState
        title="No s'ha pogut inicialitzar el motor de consultes."
        message="Prova-ho amb un altre navegador; aquesta aplicació necessita compatibilitat amb WebAssembly."
      />
    )
  } else if (dataState.status === 'loading') {
    content = <LoadingBlock text="Carregant les dades de l'enquesta…" />
  } else if (dataState.status === 'error') {
    content = <ErrorState message={dataState.message} onRetry={onDataRetry} />
  } else {
    const { meta, rows } = dataState.data
    headerTitle = meta.title
    content = (
      <>
        <DataDictionary fields={meta.fields} />
        <div className="min-h-screen">
          <GraphicWalker
            dataSource={rows}
            rawFields={toGraphicWalkerFields(meta.fields ?? [])}
            appearance={theme}
          />
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <ExplorerHeader title={headerTitle} />
      {content}
    </div>
  )
}
