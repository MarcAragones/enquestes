import { Link, useParams } from 'react-router-dom'

export default function ExplorerPage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="space-y-4">
      <p className="text-zinc-700 dark:text-zinc-300">
        L'explorador interactiu per a l'enquesta <strong>{id}</strong> encara no està
        disponible.
      </p>
      <Link to="/" className="text-accent hover:text-accent-strong">
        ← Torna al catàleg
      </Link>
    </div>
  )
}
