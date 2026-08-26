import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dataUrl, parseEnquestesIndex } from '../lib/enquestes'
import type { EnquestaIndexEntry, FetchState } from '../types/enquesta'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { ErrorState } from '../components/ErrorState'
import { EmptyState } from '../components/EmptyState'
import { SurveyGrid } from '../components/SurveyGrid'

export function HomePage() {
  const [state, setState] = useState<FetchState<EnquestaIndexEntry[]>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const navigate = useNavigate()

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
  const onSelect = (id: string) => navigate(`/enquesta/${id}`)

  if (state.status === 'loading') {
    return <LoadingSkeleton />
  }

  if (state.status === 'error') {
    return <ErrorState message={state.message} onRetry={onRetry} />
  }

  if (state.data.length === 0) {
    return <EmptyState />
  }

  return <SurveyGrid enquestes={state.data} onSelect={onSelect} />
}
