export interface EnquestaIndexEntry {
  id: string
  title: string
  date: string
  description: string
  n: number
}

export interface EnquestaMetaKpi {
  label: string
  value: number | string
  unit?: string
  n?: number
}

export interface EnquestaMetaField {
  name: string
  label?: string
  description?: string
  type: 'dimension' | 'measure'
}

export interface EnquestaMeta {
  id: string
  title: string
  date: string
  description: string
  n: number
  kpis: EnquestaMetaKpi[]
  fields?: EnquestaMetaField[]
}

export type FetchState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T }
