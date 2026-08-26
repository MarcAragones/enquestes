import { describe, expect, it } from 'vitest'
import { toGraphicWalkerFields } from './graphicWalkerFields'
import type { EnquestaMetaField } from '../types/enquesta'

// Real mostra-sintetica field list (public/data/enquestes/mostra-sintetica_meta.json).
const MOSTRA_SINTETICA_FIELDS: EnquestaMetaField[] = [
  { name: 'edat', type: 'measure' },
  { name: 'satisfaccio', type: 'measure' },
  { name: 'recomanaria', type: 'measure' },
  { name: 'segment', type: 'dimension' },
  { name: 'canal', type: 'dimension' },
  { name: 'territori', type: 'dimension' },
]

describe('toGraphicWalkerFields', () => {
  const mapped = toGraphicWalkerFields(MOSTRA_SINTETICA_FIELDS)
  const byName = (name: string) => mapped.find((f) => f.fid === name)

  it('maps edat, satisfaccio, recomanaria to measure/quantitative', () => {
    for (const name of ['edat', 'satisfaccio', 'recomanaria']) {
      expect(byName(name)).toMatchObject({ analyticType: 'measure', semanticType: 'quantitative' })
    }
  })

  it('maps segment, canal, territori to dimension/nominal', () => {
    for (const name of ['segment', 'canal', 'territori']) {
      expect(byName(name)).toMatchObject({ analyticType: 'dimension', semanticType: 'nominal' })
    }
  })

  it('sets fid to the source name for every entry', () => {
    for (const field of MOSTRA_SINTETICA_FIELDS) {
      expect(byName(field.name)?.fid).toBe(field.name)
    }
  })

  it('falls back to the source name when label is absent, uses label when present', () => {
    const withLabel = toGraphicWalkerFields([
      { name: 'edat', label: 'Edat (anys)', type: 'measure' },
    ])
    expect(withLabel[0].name).toBe('Edat (anys)')

    const withoutLabel = toGraphicWalkerFields([{ name: 'edat', type: 'measure' }])
    expect(withoutLabel[0].name).toBe('edat')
  })

  it('returns an empty array for an empty input without throwing', () => {
    expect(() => toGraphicWalkerFields([])).not.toThrow()
    expect(toGraphicWalkerFields([])).toEqual([])
  })

  it('does not read any Parquet dtype, only the meta field declared type', () => {
    // toGraphicWalkerFields takes only EnquestaMetaField[] (name/label/description/type) —
    // there is no Parquet/Arrow input to this function at all, so a call with the minimal
    // meta shape (no dtype-adjacent data) must still produce correct types.
    const result = toGraphicWalkerFields([{ name: 'x', type: 'dimension' }])
    expect(result).toEqual([
      { fid: 'x', name: 'x', analyticType: 'dimension', semanticType: 'nominal' },
    ])
  })
})
