import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { openDialogLifecycle } from '../lib/dialogLifecycle'
import {
  formatCount,
  formatDate,
  isValidEnquestaId,
  MIN_KPI_SAMPLE,
  metaUrl,
  parseEnquestaMeta,
} from '../lib/enquestes'
import type { EnquestaMeta, FetchState } from '../types/enquesta'

const INVALID_ID_MESSAGE = "No s'ha pogut carregar el resum d'aquesta enquesta."

/**
 * Raised only when metaUrl(id) responds with a 404 specifically, so the
 * `.catch()` classifier below can distinguish "this survey does not exist"
 * from any other (plausibly transient) fetch failure — mirroring
 * ExplorerPage's identical `SurveyNotFoundError`/`DataErrorKind`
 * classification (G-03-2b), which hits this exact same `metaUrl(id)`
 * endpoint (WR-04).
 */
class SurveyNotFoundError extends Error {}

const NOT_FOUND_MESSAGE = "Aquesta enquesta ja no existeix o l'enllaç no és correcte."
const LOAD_FAILED_MESSAGE = "No s'ha pogut carregar el resum d'aquesta enquesta. Comprova la connexió i torna-ho a provar."

interface SurveySummaryModalProps {
  enquestaId: string
  onClose: () => void
}

export function SurveySummaryModal({ enquestaId, onClose }: SurveySummaryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  // Absorbs exactly one spurious close per lifecycle-initiated cleanup close
  // (StrictMode's simulated unmount). Must be a ref, not a variable declared
  // inside the effect: StrictMode re-runs the effect on the SAME component
  // instance, so only a ref carries the count from the cleanup that queued
  // the close event to the handler re-attached by the very next setup. See
  // src/lib/dialogLifecycle.ts (G-03-5).
  const closeSuppressCountRef = useRef(0)
  const [state, setState] = useState<FetchState<EnquestaMeta>>({ status: 'loading' })
  const navigate = useNavigate()

  // Reset to loading whenever enquestaId changes, following React's
  // "adjusting state when a prop changes" pattern (calling setState during
  // render, not inside an effect body) — the project's lint config
  // (react-hooks/set-state-in-effect) forbids a synchronous setState in an
  // effect precisely because it costs an extra cascading render; this
  // render-time bailout re-renders immediately with the reset state before
  // the fetch effect below even runs. Without this, a component instance
  // that stays mounted across an enquestaId change (HomePage renders this
  // modal without a `key`) keeps showing the previous survey's
  // already-fetched content while the new fetch is in flight (WR-03) — e.g.
  // Back/Forward between two `?enquesta=` history entries.
  const [trackedEnquestaId, setTrackedEnquestaId] = useState(enquestaId)
  if (enquestaId !== trackedEnquestaId) {
    setTrackedEnquestaId(enquestaId)
    setState({ status: 'loading' })
  }

  // Always points at the latest onClose. HomePage re-creates onCloseSummary
  // on every render, so the lifecycle effect below reads it through this
  // ref instead of taking it as a dependency — an [onClose] dependency
  // would tear down and rebuild the dialog lifecycle (detach/reattach the
  // 'close' listener, and briefly leave the dialog without one) on every
  // parent render.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    // The dialog's native 'close' event is queued asynchronously, not
    // dispatched synchronously by close() — see src/lib/dialogLifecycle.ts
    // for why that breaks a StrictMode-safe lifecycle and how the
    // suppression counter fixes it regardless of dispatch timing (G-03-5).
    return openDialogLifecycle(dialog, () => onCloseRef.current(), closeSuppressCountRef)
  }, [])

  const idValid = isValidEnquestaId(enquestaId)

  useEffect(() => {
    // Guard first: an invalid id never reaches the network — the render
    // branch below shows the failure state directly without an effect
    // needing to set it synchronously.
    if (!idValid) return

    // The `state` reset to 'loading' for a new enquestaId happens above,
    // during render (WR-03) — not here, to avoid a setState-in-effect
    // cascading render.
    let cancelled = false

    fetch(metaUrl(enquestaId))
      .then((res) => {
        if (res.status === 404) throw new SurveyNotFoundError()
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        const data = parseEnquestaMeta(body)
        if (!cancelled) setState({ status: 'success', data })
      })
      .catch((err) => {
        if (!cancelled) {
          // A 404 on this survey's own metadata means the survey does not
          // exist (a stale `?enquesta=` link) — a different, more specific
          // situation than a transient load failure, and one the generic
          // message previously conflated (WR-04, mirroring ExplorerPage's
          // G-03-2b fix for the identical `metaUrl(id)` endpoint).
          setState({
            status: 'error',
            message: err instanceof SurveyNotFoundError ? NOT_FOUND_MESSAGE : LOAD_FAILED_MESSAGE,
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [enquestaId, idValid])

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      dialogRef.current?.close()
    }
  }

  const handleExplore = () => navigate(`/enquesta/${encodeURIComponent(enquestaId)}`)

  // `m-auto` restores the browser's own `dialog:modal { margin: auto }`
  // centering, which Tailwind v4 Preflight's universal `*, ::backdrop
  // { margin: 0 }` reset destroys: an author-origin rule always outranks a
  // user-agent rule regardless of specificity, so Preflight's base-layer
  // margin reset silently wins over the UA stylesheet without this. This
  // utility-layer class is what wins the resulting author-vs-author fight,
  // since Tailwind declares its layers `theme, base, components, utilities`
  // in that order. Load-bearing, not decorative — see G-03-7 /
  // tailwindlabs/tailwindcss#16372.
  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="m-auto w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 text-zinc-900 backdrop:bg-black/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      {!idValid && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <p className="font-semibold text-red-800 dark:text-red-200">{INVALID_ID_MESSAGE}</p>
        </div>
      )}

      {idValid && state.status === 'loading' && (
        <div className="animate-pulse space-y-3" aria-busy="true">
          <div className="h-6 w-2/3 rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-4 w-1/3 rounded bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-20 rounded bg-zinc-100 dark:bg-zinc-800" />
        </div>
      )}

      {idValid && state.status === 'error' && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <p className="font-semibold text-red-800 dark:text-red-200">{state.message}</p>
        </div>
      )}

      {idValid && state.status === 'success' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">{state.data.title}</h2>
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {formatDate(state.data.date)}
            </p>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">{state.data.description}</p>
          <p className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
            {formatCount(state.data.n)} {state.data.n === 1 ? 'participant' : 'participants'}
          </p>

          {state.data.kpis.length === 0 ? (
            <p className="text-zinc-500 dark:text-zinc-400">
              Aquesta enquesta encara no té KPIs publicats.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {state.data.kpis.map((kpi, i) => {
                const effectiveN = kpi.n ?? state.data.n
                const suppressed = effectiveN < MIN_KPI_SAMPLE
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                  >
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
                    {suppressed ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Mostra insuficient per publicar aquest valor
                      </p>
                    ) : (
                      <p className="text-base font-semibold tabular-nums">
                        {kpi.value}
                        {kpi.unit ? ` ${kpi.unit}` : ''}
                      </p>
                    )}
                    <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                      n = {formatCount(effectiveN)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-zinc-700 hover:border-accent hover:text-accent dark:border-zinc-800 dark:text-zinc-300"
        >
          Tanca
        </button>
        <button
          type="button"
          onClick={handleExplore}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent-strong"
        >
          Explorar dades interactives
        </button>
      </div>
    </dialog>
  )
}
