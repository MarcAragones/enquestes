import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { GraphicWalker } from '@kanaries/graphic-walker'
import type { IChart, VizSpecStore } from '@kanaries/graphic-walker'
import '@kanaries/graphic-walker/dist/style.css'
import { isValidEnquestaId, metaUrl, parseEnquestaMeta } from '../lib/enquestes'
import { toGraphicWalkerFields } from '../lib/graphicWalkerFields'
import { SHARE_PARAM, decodeShareLink, encodeShareLink } from '../lib/shareLink'
import { getDb, queryParquet, resetDb } from '../services/duckdb'
import { ErrorState } from '../components/ErrorState'
import { ChartErrorBoundary } from '../components/ChartErrorBoundary'
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
  const [searchParams] = useSearchParams()

  const [engineState, setEngineState] = useState<FetchState<true>>({ status: 'loading' })
  const [dataState, setDataState] = useState<FetchState<ExplorerData>>({ status: 'loading' })
  const [dataAttempt, setDataAttempt] = useState(0)
  const [engineAttempt, setEngineAttempt] = useState(0)

  // storeRef, not a change-callback + useState: the current chart spec is
  // read synchronously from this ref only inside the copy-link click
  // handler (D-05's serialize-on-click model). Holding it in state instead
  // would re-render (and risk remounting) the canvas on every chart edit.
  const vizStoreRef = useRef<VizSpecStore | null>(null)

  // The address bar is never synced to the chart's live state (D-05): this
  // reads the ?chart= param present on mount/navigation only, and the
  // decode below never calls a search-param setter or history API.
  const rawChartParam = searchParams.get(SHARE_PARAM)

  // Computed once per (raw param, loaded meta) pair, never per render — a
  // fresh object reference on every render would make GraphicWalker treat
  // the `chart` prop as having changed and remount the canvas mid-session.
  // Gated on dataState so decode never runs against an empty known-field
  // list while meta.json is still loading (schema-drift guard, D-07).
  const decodedChart = useMemo(() => {
    if (dataState.status !== 'success') return undefined
    const knownFieldNames = dataState.data.meta.fields?.map((f) => f.name) ?? []
    return decodeShareLink(rawChartParam, knownFieldNames) as IChart[] | undefined
  }, [rawChartParam, dataState])

  const onCopyLink = async () => {
    const chart = vizStoreRef.current?.exportCode()
    if (!chart) return
    const encoded = encodeShareLink(chart)
    if (encoded === null) return
    const url = new URL(window.location.href)
    url.searchParams.set(SHARE_PARAM, encoded)
    try {
      await navigator.clipboard.writeText(url.toString())
    } catch {
      // A clipboard-write failure (permissions, insecure context) is not
      // surfaced to the visitor — same silent-fallback posture as D-07.
    }
  }

  // Phase 1: DuckDB-Wasm engine init. `initDb()`'s failure is not limited to
  // an incompatible-browser cause — it also fetches/compiles a multi-MB wasm
  // binary over the network, which can fail transiently (WR-03) — so this
  // phase offers a retry the same way phase 2 does, resetting the cached
  // engine promise via resetDb() before re-attempting.
  useEffect(() => {
    if (!valid) return
    let cancelled = false

    getDb()
      .then(() => {
        if (!cancelled) setEngineState({ status: 'success', data: true })
      })
      .catch(() => {
        if (!cancelled) {
          setEngineState({
            status: 'error',
            message: "No s'ha pogut inicialitzar el motor de consultes. Comprova la connexió i torna-ho a provar.",
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [valid, engineAttempt])

  const onEngineRetry = () => {
    resetDb()
    setEngineState({ status: 'loading' })
    setEngineAttempt((a) => a + 1)
  }

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
  let headerCopyLink: (() => Promise<void>) | undefined
  let content
  if (!valid) {
    content = <p className="text-zinc-700 dark:text-zinc-300">No s'ha trobat aquesta enquesta.</p>
  } else if (engineState.status === 'loading') {
    content = <LoadingBlock text="Inicialitzant el motor de consultes…" />
  } else if (engineState.status === 'error') {
    content = (
      <ErrorState
        title="No s'ha pogut inicialitzar el motor de consultes."
        message={engineState.message}
        onRetry={onEngineRetry}
      />
    )
  } else if (dataState.status === 'loading') {
    content = <LoadingBlock text="Carregant les dades de l'enquesta…" />
  } else if (dataState.status === 'error') {
    content = <ErrorState message={dataState.message} onRetry={onDataRetry} />
  } else {
    const { meta, rows } = dataState.data
    headerTitle = meta.title
    headerCopyLink = onCopyLink
    content = (
      <>
        <DataDictionary fields={meta.fields} />
        <div className="min-h-screen">
          <ChartErrorBoundary key={rawChartParam ?? 'no-chart'}>
            <GraphicWalker
              dataSource={rows}
              rawFields={toGraphicWalkerFields(meta.fields ?? [])}
              appearance={theme}
              storeRef={vizStoreRef}
              chart={decodedChart}
            />
          </ChartErrorBoundary>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <ExplorerHeader title={headerTitle} onCopyLink={headerCopyLink} />
      {content}
    </div>
  )
}
