import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

interface SurveySummaryModalProps {
  enquestaId: string
  onClose: () => void
}

export function SurveySummaryModal({ enquestaId, onClose }: SurveySummaryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  const [state, setState] = useState<FetchState<EnquestaMeta>>({ status: 'loading' })
  const navigate = useNavigate()

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

    const handleClose = () => onCloseRef.current()
    dialog.addEventListener('close', handleClose)
    if (!dialog.open) dialog.showModal()

    // Cleanup order is the entire fix for G-03-2: detach the 'close'
    // listener BEFORE closing the element. React StrictMode's dev-only
    // mount -> simulated-unmount -> remount cycle runs this cleanup even
    // though nothing was ever visitor-dismissed. If the listener were still
    // attached at that point, the imperative close() below would dispatch a
    // real native 'close' event into it, invoking onClose (which deletes
    // the ?enquesta= param that keeps this modal mounted) for a lifecycle
    // event that was never a genuine visitor action — the modal would
    // appear to open then vanish. With the listener detached first, that
    // simulated close() fires into nothing, and the remount right after
    // finds the element already closed, so the `!dialog.open` guard above
    // lets showModal() run again without throwing InvalidStateError. A
    // genuine dismissal (Escape / Tanca / backdrop click) still invokes
    // onClose exactly once, since the listener is attached while it
    // happens; a real unmount right after that dismissal calls close() on
    // an already-closed element, which is a specified no-op that dispatches
    // no event.
    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.close()
    }
  }, [])

  const idValid = isValidEnquestaId(enquestaId)

  useEffect(() => {
    // Guard first: an invalid id never reaches the network — the render
    // branch below shows the failure state directly without an effect
    // needing to set it synchronously.
    if (!idValid) return

    // Reset to loading synchronously whenever this effect re-runs for a
    // new id. Without this, a component instance that stays mounted across
    // an enquestaId change (HomePage renders this modal without a `key`)
    // keeps showing the previous survey's already-fetched content while the
    // new fetch is in flight (WR-03) — e.g. Back/Forward between two
    // `?enquesta=` history entries.
    setState({ status: 'loading' })

    let cancelled = false

    fetch(metaUrl(enquestaId))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        const data = parseEnquestaMeta(body)
        if (!cancelled) setState({ status: 'success', data })
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: "No s'ha pogut carregar el resum d'aquesta enquesta.",
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

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 text-zinc-900 backdrop:bg-black/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
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
