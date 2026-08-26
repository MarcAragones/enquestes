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
  const [state, setState] = useState<FetchState<EnquestaMeta>>({ status: 'loading' })
  const navigate = useNavigate()

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  const idValid = isValidEnquestaId(enquestaId)

  useEffect(() => {
    // Guard first: an invalid id never reaches the network — the render
    // branch below shows the failure state directly without an effect
    // needing to set it synchronously.
    if (!idValid) return

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
