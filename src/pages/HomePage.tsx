import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { dataUrl, isValidEnquestaId, parseEnquestesIndex } from '../lib/enquestes'
import type { EnquestaIndexEntry, FetchState } from '../types/enquesta'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorState } from '../components/ErrorState'
import { EmptyState } from '../components/EmptyState'
import { SurveyGrid } from '../components/SurveyGrid'
import { SurveySummaryModal } from '../components/SurveySummaryModal'

export function HomePage() {
  const [state, setState] = useState<FetchState<EnquestaIndexEntry[]>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    let cancelled = false

    fetch(dataUrl('enquestes_index.json'))
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        const data = parseEnquestesIndex(body)
        if (!cancelled) setState({ status: 'success', data })
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: "No s'ha pogut carregar el llistat d'enquestes.",
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [attempt])

  const onRetry = () => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }

  const rawEnquestaId = searchParams.get('enquesta')
  const openEnquestaId = rawEnquestaId && isValidEnquestaId(rawEnquestaId) ? rawEnquestaId : null

  useEffect(() => {
    // A hand-edited param that fails validation should never mount a modal
    // that only fails — drop it and leave the plain catalog visible.
    if (rawEnquestaId && !isValidEnquestaId(rawEnquestaId)) {
      setSearchParams((params) => {
        params.delete('enquesta')
        return params
      })
    }
  }, [rawEnquestaId, setSearchParams])

  const onSelect = (id: string) => {
    setSearchParams((params) => {
      params.set('enquesta', id)
      return params
    })
  }
  const onCloseSummary = () => {
    setSearchParams((params) => {
      params.delete('enquesta')
      return params
    })
  }

  let content
  if (state.status === 'loading') {
    content = <LoadingSkeleton />
  } else if (state.status === 'error') {
    content = <ErrorState message={state.message} onRetry={onRetry} />
  } else if (state.data.length === 0) {
    content = <EmptyState />
  } else {
    content = <SurveyGrid enquestes={state.data} onSelect={onSelect} />
  }

  return (
    <>
      {content}
      {openEnquestaId && <SurveySummaryModal enquestaId={openEnquestaId} onClose={onCloseSummary} />}
    </>
  )
}
