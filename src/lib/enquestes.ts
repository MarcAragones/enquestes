import type { EnquestaIndexEntry } from '../types/enquesta'

/**
 * The only function in the codebase permitted to compose a data URL.
 * Composing from `import.meta.env.BASE_URL` keeps every data read aligned
 * with vite.config.ts's `base` — a hardcoded root-relative path works in
 * `vite dev` but 404s once the app is served under `/enquestes/`.
 */
export function dataUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}data/${relativePath}`
}

/**
 * Trust boundary for the JSON fetched from enquestes_index.json. Rejects
 * any shape that doesn't match EnquestaIndexEntry[] instead of letting a
 * malformed payload flow into the render tree.
 */
export function parseEnquestesIndex(input: unknown): EnquestaIndexEntry[] {
  if (!Array.isArray(input)) {
    throw new Error('Format inesperat')
  }

  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error('Format inesperat')
    }
    const { id, title, date, description, n } = entry as Record<string, unknown>
    if (
      typeof id !== 'string' ||
      typeof title !== 'string' ||
      typeof date !== 'string' ||
      typeof description !== 'string' ||
      typeof n !== 'number' ||
      !Number.isFinite(n)
    ) {
      throw new Error('Format inesperat')
    }
  }

  return input as EnquestaIndexEntry[]
}
