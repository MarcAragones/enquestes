import type { EnquestaIndexEntry, EnquestaMeta } from '../types/enquesta'

/** Sample size below which a KPI value is withheld rather than published. */
export const MIN_KPI_SAMPLE = 10

/**
 * True only for the restricted id shape a survey id must have. The id
 * arrives from a URL segment or search param — visitor-controlled — so it
 * is validated before it can influence any fetch path.
 */
export function isValidEnquestaId(id: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(id)
}

/**
 * Percent-encodes on top of isValidEnquestaId's restriction, so no path
 * separator can survive into the request even if validation were bypassed.
 */
export function metaUrl(id: string): string {
  return dataUrl(`enquestes/${encodeURIComponent(id)}_meta.json`)
}

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

/**
 * Catalan long-form date, e.g. "26 d'agost de 2026". Returns the input
 * string unchanged when it does not parse into a valid Date — a malformed
 * date field should still show something truthful, never "Invalid Date".
 */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso
  }
  return new Intl.DateTimeFormat('ca-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    d,
  )
}

/** Catalan-locale thousands grouping for participant counts. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('ca-ES').format(n)
}

/**
 * Second trust boundary in the app, mirroring parseEnquestesIndex. Rejects
 * any shape that doesn't match EnquestaMeta instead of letting a malformed
 * payload flow into the render tree.
 */
export function parseEnquestaMeta(input: unknown): EnquestaMeta {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Format inesperat')
  }
  const { id, title, date, description, n, kpis, fields } = input as Record<string, unknown>

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

  if (!Array.isArray(kpis)) {
    throw new Error('Format inesperat')
  }
  for (const kpi of kpis) {
    if (typeof kpi !== 'object' || kpi === null) {
      throw new Error('Format inesperat')
    }
    const { label, value, unit, n: kpiN } = kpi as Record<string, unknown>
    if (typeof label !== 'string') throw new Error('Format inesperat')
    if (typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))) {
      throw new Error('Format inesperat')
    }
    if (unit !== undefined && typeof unit !== 'string') throw new Error('Format inesperat')
    if (kpiN !== undefined && !(typeof kpiN === 'number' && Number.isFinite(kpiN))) {
      throw new Error('Format inesperat')
    }
  }

  if (fields !== undefined) {
    if (!Array.isArray(fields)) {
      throw new Error('Format inesperat')
    }
    for (const field of fields) {
      if (typeof field !== 'object' || field === null) {
        throw new Error('Format inesperat')
      }
      const { name, type } = field as Record<string, unknown>
      if (typeof name !== 'string') throw new Error('Format inesperat')
      if (type !== 'dimension' && type !== 'measure') throw new Error('Format inesperat')
    }
  }

  return input as EnquestaMeta
}
