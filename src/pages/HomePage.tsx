import { useEffect, useState } from 'react'
import { dataUrl, parseEnquestesIndex } from '../lib/enquestes'
import type { EnquestaIndexEntry, FetchState } from '../types/enquesta'

export function HomePage() {
  const [state, setState] = useState<FetchState<EnquestaIndexEntry[]>>({ status: 'loading' })

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
  }, [])

  if (state.status === 'loading') {
    return (
      <p role="status" className="text-zinc-500 dark:text-zinc-400">
        Carregant enquestes…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        {state.message}
      </p>
    )
  }

  if (state.data.length === 0) {
    return (
      <p className="text-zinc-500 dark:text-zinc-400">
        Encara no hi ha cap enquesta publicada.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {state.data.map((enquesta) => (
        <li
          key={enquesta.id}
          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{enquesta.title}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{enquesta.date}</p>
          <p className="text-zinc-700 dark:text-zinc-300">{enquesta.description}</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{enquesta.n} participants</p>
        </li>
      ))}
    </ul>
  )
}
