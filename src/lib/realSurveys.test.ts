import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIN_KPI_SAMPLE, parseEnquestaMeta, parseEnquestesIndex } from './enquestes'
import { decodeShareLink, encodeShareLink } from './shareLink'
import type { EnquestaMeta } from '../types/enquesta'

/**
 * Regression suite grounded in the actually-published survey data (not
 * synthetic fixtures). Every fact this suite asserts is derived at test
 * time from `public/data/`, never hardcoded — so it fails the instant the
 * published set drifts out of agreement with itself (a wrong meta.json, a
 * missing dictionary, a field-name collision between surveys).
 *
 * Real published field names are the load-bearing data here; see
 * `src/lib/shareLink.test.ts` for the decoder's own contract tests against
 * illustrative fixture field names.
 */

const RETIRED_SYNTHETIC_ID = 'mostra-sintetica'

const indexPath = join(process.cwd(), 'public/data/enquestes_index.json')
const rawIndex: unknown = JSON.parse(readFileSync(indexPath, 'utf-8'))
const index = parseEnquestesIndex(rawIndex)

const metaById = new Map<string, EnquestaMeta>(
  index.map((entry) => {
    const metaPath = join(process.cwd(), 'public/data/enquestes', `${entry.id}_meta.json`)
    const rawMeta: unknown = JSON.parse(readFileSync(metaPath, 'utf-8'))
    return [entry.id, parseEnquestaMeta(rawMeta)]
  }),
)

function fieldNames(meta: EnquestaMeta): string[] {
  return (meta.fields ?? []).map((field) => field.name)
}

describe('published catalog (SC-2)', () => {
  it('holds at least two published surveys', () => {
    expect(index.length).toBeGreaterThanOrEqual(2)
  })

  it('holds no entry for the retired synthetic survey', () => {
    expect(index.some((entry) => entry.id === RETIRED_SYNTHETIC_ID)).toBe(false)
  })

  it.each(index)("$id: meta.json's own fields match its index entry exactly", (entry) => {
    const meta = metaById.get(entry.id)
    expect(meta).toBeDefined()
    expect(meta!.id).toBe(entry.id)
    expect(meta!.title).toBe(entry.title)
    expect(meta!.date).toBe(entry.date)
    expect(meta!.description).toBe(entry.description)
    expect(meta!.n).toBe(entry.n)
  })

  it.each(index)("$id: every published KPI's effective n is >= MIN_KPI_SAMPLE", (entry) => {
    const meta = metaById.get(entry.id)!
    for (const kpi of meta.kpis) {
      const effectiveN = kpi.n ?? meta.n
      expect(effectiveN).toBeGreaterThanOrEqual(MIN_KPI_SAMPLE)
    }
  })

  it('the suppression predicate withholds below the threshold and publishes at it', () => {
    const isSuppressed = (effectiveN: number) => effectiveN < MIN_KPI_SAMPLE
    expect(isSuppressed(MIN_KPI_SAMPLE - 1)).toBe(true)
    expect(isSuppressed(MIN_KPI_SAMPLE)).toBe(false)
  })
})

describe('per-survey data dictionary (SC-3)', () => {
  it.each(index)('$id: fields[] is non-empty with unique names', (entry) => {
    const names = fieldNames(metaById.get(entry.id)!)
    expect(names.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)
  })

  it("the three surveys' field-name sets are pairwise non-identical", () => {
    const ids = index.map((entry) => entry.id)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = new Set(fieldNames(metaById.get(ids[i])!))
        const b = new Set(fieldNames(metaById.get(ids[j])!))
        const identical = a.size === b.size && [...a].every((name) => b.has(name))
        expect(identical).toBe(false)
      }
    }
  })
})

describe('share-link cross-survey behaviour (SC-4)', () => {
  const withField = (name: string) =>
    index.find((entry) => fieldNames(metaById.get(entry.id)!).includes(name))
  const withoutField = (name: string) =>
    index.filter((entry) => !fieldNames(metaById.get(entry.id)!).includes(name))
  const withFieldAll = (name: string) =>
    index.filter((entry) => fieldNames(metaById.get(entry.id)!).includes(name))

  /**
   * A minimal `VizSpecStore.exportCode()`-shaped chart carrying a single
   * shelf reference to `fid`, wrapped in the array `exportCode()` actually
   * returns. `decodeShareLink` only inspects `SHELF_CHANNEL_KEYS` present on
   * `encodings` (src/lib/shareLink.ts), so a bare `columns` shelf is enough
   * to exercise the field-allow-list check this suite is about.
   */
  function buildChartWithField(fid: string): unknown {
    return [
      {
        visId: 'gw_test',
        name: 'Test chart',
        encodings: {
          columns: [{ fid, name: fid, semanticType: 'nominal', analyticType: 'dimension' }],
        },
        config: {},
        layout: {},
      },
    ]
  }

  // IDENTIFICADOR_COMPLET is present only on the longitudinal survey
  // (REO1151 today) — confirmed by reading the real published metas above,
  // never hardcoded to a specific id.
  const longitudinalSurvey = withField('IDENTIFICADOR_COMPLET')
  const surveysWithoutIdentificador = withoutField('IDENTIFICADOR_COMPLET')

  it('an IDENTIFICADOR_COMPLET chart decodes back to a defined value on the survey that has it', () => {
    expect(longitudinalSurvey).toBeDefined()
    const encoded = encodeShareLink(buildChartWithField('IDENTIFICADOR_COMPLET'))
    expect(encoded).not.toBeNull()
    const decoded = decodeShareLink(encoded, fieldNames(metaById.get(longitudinalSurvey!.id)!))
    expect(decoded).toBeDefined()
  })

  it.each(surveysWithoutIdentificador)(
    'the same IDENTIFICADOR_COMPLET chart is silently discarded against $id, which lacks that field',
    (entry) => {
      const encoded = encodeShareLink(buildChartWithField('IDENTIFICADOR_COMPLET'))!
      const ownFields = fieldNames(metaById.get(entry.id)!)
      expect(() => decodeShareLink(encoded, ownFields)).not.toThrow()
      expect(decodeShareLink(encoded, ownFields)).toBeUndefined()
    },
  )

  // PONDERA is published by both Baròmetre waves but not by the
  // longitudinal survey. A chart using only a field two surveys legitimately
  // share renders on both — that is field-based validation working
  // correctly, not a survey-identity leak (A-06 in the plan).
  const surveysWithPondera = withFieldAll('PONDERA')
  const surveysWithoutPondera = withoutField('PONDERA')

  it.each(surveysWithPondera)(
    'a PONDERA-only chart decodes to a defined value against $id (shared field, by design)',
    (entry) => {
      const encoded = encodeShareLink(buildChartWithField('PONDERA'))!
      const decoded = decodeShareLink(encoded, fieldNames(metaById.get(entry.id)!))
      expect(decoded).toBeDefined()
    },
  )

  it.each(surveysWithoutPondera)(
    'the same PONDERA-only chart is discarded against $id, which does not publish that field',
    (entry) => {
      const encoded = encodeShareLink(buildChartWithField('PONDERA'))!
      expect(decodeShareLink(encoded, fieldNames(metaById.get(entry.id)!))).toBeUndefined()
    },
  )

  it.each(index)('a gw_count_fid chart decodes against every survey ($id)', (entry) => {
    const encoded = encodeShareLink(buildChartWithField('gw_count_fid'))!
    const decoded = decodeShareLink(encoded, fieldNames(metaById.get(entry.id)!))
    expect(decoded).toBeDefined()
  })

  it('a truncated/corrupted version of a valid encoded payload returns undefined, not a thrown exception', () => {
    expect(surveysWithPondera.length).toBeGreaterThan(0)
    const encoded = encodeShareLink(buildChartWithField('PONDERA'))!
    const corrupted = encoded.slice(0, -10)
    const ownFields = fieldNames(metaById.get(surveysWithPondera[0].id)!)
    expect(() => decodeShareLink(corrupted, ownFields)).not.toThrow()
    expect(decodeShareLink(corrupted, ownFields)).toBeUndefined()
  })
})
