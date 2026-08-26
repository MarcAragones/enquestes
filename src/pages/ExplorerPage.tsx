import { Link, useParams } from 'react-router-dom'
import { isValidEnquestaId } from '../lib/enquestes'

export default function ExplorerPage() {
  const { id } = useParams<{ id: string }>()
  const valid = id !== undefined && isValidEnquestaId(id)

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-zinc-300 p-6 dark:border-zinc-700">
      {valid ? (
        <>
          <h1 className="text-lg font-semibold">Explorador interactiu</h1>
          <p className="text-zinc-700 dark:text-zinc-300">
            L'explorador interactiu d'aquesta enquesta encara no està disponible.
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Enquesta: {id}</p>
        </>
      ) : (
        <p className="text-zinc-700 dark:text-zinc-300">No s'ha trobat aquesta enquesta.</p>
      )}
      <Link to="/" className="inline-block text-accent hover:text-accent-strong">
        ← Torna al llistat d'enquestes
      </Link>
    </div>
  )
}
