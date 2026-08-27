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

/**
 * Local to this page only — FetchState<T>'s error arm carries a plain
 * message string and other pages depend on that shape, so it is not widened.
 * `dataState` needs to distinguish "this survey does not exist" from "the
 * load failed" (G-03-2b), which a shared message string cannot express.
 */
type DataErrorKind = 'not-found' | 'load-failed'

type ExplorerDataState =
  | { status: 'loading' }
  | { status: 'error'; kind: DataErrorKind }
  | { status: 'success'; data: ExplorerData }

/**
 * Raised only when metaUrl(id) responds with a 404 specifically, so its
 * type survives Promise settlement and the classifier below can give a
 * non-existent survey priority over any other concurrent rejection (e.g.
 * the Parquet query, which also fails for a non-existent id, but with a
 * less specific reason).
 */
class SurveyNotFoundError extends Error {}

const NOT_FOUND_TITLE = "No s'ha trobat aquesta enquesta."
const NOT_FOUND_MESSAGE = "Comprova l'enllaç o torna al llistat d'enquestes."
const LOAD_FAILED_TITLE = "No s'han pogut carregar les dades d'aquesta enquesta."
const LOAD_FAILED_MESSAGE = 'Comprova la connexió i torna-ho a provar.'

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
  const [dataState, setDataState] = useState<ExplorerDataState>({ status: 'loading' })
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
  // transient (network blip), so this phase offers a retry — except when the
  // survey itself does not exist, where a retry can never succeed (G-03-2b).
  //
  // Both requests are settled together (Promise.allSettled), never raced
  // (Promise.all): a non-existent survey 404s on the metadata request AND
  // fails the Parquet query, so racing them makes the surfaced reason depend
  // on which one loses first. Classification below applies a fixed priority
  // instead — a metadata 404 always wins over any other concurrent failure.
  useEffect(() => {
    if (!valid || id === undefined || engineState.status !== 'success') return
    let cancelled = false

    Promise.allSettled([
      fetch(metaUrl(id)).then((res) => {
        if (res.status === 404) throw new SurveyNotFoundError()
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      }),
      queryParquet(id),
    ]).then(([metaResult, rowsResult]) => {
      if (cancelled) return

      if (metaResult.status === 'rejected' && metaResult.reason instanceof SurveyNotFoundError) {
        setDataState({ status: 'error', kind: 'not-found' })
        return
      }
      if (metaResult.status === 'rejected' || rowsResult.status === 'rejected') {
        setDataState({ status: 'error', kind: 'load-failed' })
        return
      }

      try {
        const meta = parseEnquestaMeta(metaResult.value)
        setDataState({ status: 'success', data: { meta, rows: rowsResult.value } })
      } catch {
        setDataState({ status: 'error', kind: 'load-failed' })
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
    // A malformed id and a non-existent id present identically to a
    // visitor — isValidEnquestaId only checks URL-segment shape, so the two
    // cases are indistinguishable from the outside and share this branch's
    // treatment (no retry: retrying can never make a bad id become valid).
    content = <ErrorState title={NOT_FOUND_TITLE} message={NOT_FOUND_MESSAGE} />
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
    // A 404 on this survey's own metadata never offers a retry (G-03-2b) —
    // retrying a survey that does not exist cannot succeed and only invites
    // the visitor to keep trying. Any other failure is plausibly transient,
    // so it keeps the retry affordance.
    content =
      dataState.kind === 'not-found' ? (
        <ErrorState title={NOT_FOUND_TITLE} message={NOT_FOUND_MESSAGE} />
      ) : (
        <ErrorState title={LOAD_FAILED_TITLE} message={LOAD_FAILED_MESSAGE} onRetry={onDataRetry} />
      )
  } else {
    const { meta, rows } = dataState.data
    headerTitle = meta.title
    headerCopyLink = onCopyLink
    content = (
      <>
        <DataDictionary fields={meta.fields} />
        <div className="min-h-0 flex-1">
          <ChartErrorBoundary key={rawChartParam ?? 'no-chart'}>
            <GraphicWalker
              dataSource={rows}
              rawFields={toGraphicWalkerFields(meta.fields ?? [])}
              appearance={theme}
              storeRef={vizStoreRef}
              chart={decodedChart}
              // Every chart GraphicWalker creates from scratch is born with
              // layout.size.mode 'auto' (shrink-to-content) unless overridden
              // here. 'full' mode measures the real rendered container via
              // useResizeDetector() and stretches the chart to fill it
              // instead (G-03-4b). The width/height numbers are ignored in
              // 'full' mode — the type requires a complete size object, but
              // only the mode is consulted.
              defaultConfig={{
                layout: {
                  size: { mode: 'full', width: 0, height: 0 },
                },
              }}
            />
          </ChartErrorBoundary>
        </div>
      </>
    )
  }

  return (
    // h-dvh (dynamic viewport height, not min-h-screen) so a mobile
    // browser's collapsing address bar doesn't push the canvas past the
    // fold; flex-col + the canvas wrapper's flex-1 min-h-0 is what makes
    // GraphicWalker's defaultConfig 'full' mode have a real, definite
    // container height to measure (G-03-4b) — the prop alone is inert
    // without it. No overflow clip here: GraphicWalker scrolls internally,
    // and clipping at this level would make the header/dictionary
    // unreachable in a pathological narrow-viewport case.
    <div className="flex h-dvh flex-col bg-zinc-50 text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
      <ExplorerHeader title={headerTitle} onCopyLink={headerCopyLink} />
      {content}
    </div>
  )
}
