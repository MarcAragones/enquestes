import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MIN_KPI_SAMPLE, parseEnquestaMeta, parseEnquestesIndex } from './enquestes'
import { decodeShareLink, encodeShareLink, encodeShareLinkResult, MAX_SHARE_PARAM_LENGTH } from './shareLink'
import { withFieldCatalogue } from './shareChartCatalogue'
import { toGraphicWalkerFields } from './graphicWalkerFields'
// Test-only: the library subpath resolves under vitest's `environment: 'node'`
// via the package's `./*` export map. Production code must never import it —
// see the bundle-size note in src/lib/shareChartCatalogue.ts.
import { newChart } from '@kanaries/graphic-walker/models/visSpecHistory'
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

describe('wide-survey share links (G-05-4)', () => {
  // A conservative browser-safe URL length budget — well under the ~64k+
  // most modern browsers actually accept, but a long-standing round-number
  // "safe" web convention for URLs shared across email/chat/proxies.
  const BROWSER_SAFE_URL_LENGTH = 8192
  // Node's built-in http server (used by both `vite preview` and
  // scripts/gh-pages-preview.mjs) enforces a default 16 KB total
  // header-size limit at the raw HTTP parser level — the exact limit that
  // produced the observed HTTP 431 in G-05-4 (see 05-UAT.md).
  const NODE_HEADER_LIMIT = 16384

  // Mirrors shareLink.ts's private SHELF_CHANNEL_KEYS — the channels that
  // represent shelf assignments, as opposed to the dimensions/measures
  // catalogue this plan strips before encoding.
  const SHELF_CHANNEL_KEYS = [
    'rows',
    'columns',
    'color',
    'opacity',
    'size',
    'shape',
    'theta',
    'radius',
    'longitude',
    'latitude',
    'geoId',
    'details',
    'filters',
    'text',
  ] as const

  function shelfOnly(chart: { encodings: object }): Record<string, unknown> {
    const encodings = chart.encodings as Record<string, unknown>
    const shelves: Record<string, unknown> = {}
    for (const key of SHELF_CHANNEL_KEYS) shelves[key] = encodings[key]
    return shelves
  }

  /**
   * The shape `VizSpecStore.exportCode()` actually returns after two drags:
   * a fresh chart from `newChart` (own field catalogue included, exactly as
   * GraphicWalker builds it when the explorer first mounts) with the first
   * catalogue dimension assigned to `columns` and the first catalogue
   * measure assigned to `rows`.
   */
  function buildRealisticChart(entry: (typeof index)[number]) {
    const meta = metaById.get(entry.id)!
    const fields = meta.fields ?? []
    const gwFields = toGraphicWalkerFields(fields)
    const chart = newChart(gwFields, 'Chart 1', 'gw_g054')
    const firstDimension = chart.encodings.dimensions.find((f) => !f.fid.startsWith('gw_'))
    const firstMeasure = chart.encodings.measures.find((f) => !f.fid.startsWith('gw_'))
    if (firstDimension) chart.encodings.columns = [firstDimension]
    if (firstMeasure) chart.encodings.rows = [firstMeasure]
    return { chart, fields, gwFields }
  }

  it('the widest published survey has at least 200 fields, so this suite cannot pass vacuously if the published set ever shrinks', () => {
    const counts = index.map((entry) => (metaById.get(entry.id)!.fields ?? []).length)
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(200)
  })

  it.each(index)(
    '$id: the OLD behaviour was genuinely broken — the unstripped exportCode()-shaped chart exceeds 30,000 characters of JSON',
    (entry) => {
      const { chart } = buildRealisticChart(entry)
      expect(JSON.stringify(chart).length).toBeGreaterThan(30000)
    },
  )

  it.each(index)(
    '$id: the NEW stripped, capped encoded param fits MAX_SHARE_PARAM_LENGTH and both URL-length thresholds',
    (entry) => {
      const { chart } = buildRealisticChart(entry)
      const result = encodeShareLinkResult([chart])
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.param.length).toBeLessThanOrEqual(MAX_SHARE_PARAM_LENGTH)
      const url = `https://example.github.io/enquestes/enquesta/${entry.id}?chart=${result.param}`
      expect(url.length).toBeLessThan(BROWSER_SAFE_URL_LENGTH)
      expect(url.length).toBeLessThan(NODE_HEADER_LIMIT)
    },
  )

  it.each(index)('$id: decoding restores the identical chart on every one of the fourteen shelf channels', (entry) => {
    const { chart, fields } = buildRealisticChart(entry)
    const result = encodeShareLinkResult([chart])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const names = fields.map((f) => f.name)
    const decoded = decodeShareLink(result.param, names) as { encodings: Record<string, unknown> }[] | undefined
    expect(decoded).toBeDefined()
    expect(shelfOnly(decoded![0])).toEqual(shelfOnly(chart))
  })

  it.each(index)(
    "$id: withFieldCatalogue restores a field panel deep-equal to the library's own newChart catalogue for the same survey",
    (entry) => {
      const { chart, fields, gwFields } = buildRealisticChart(entry)
      const result = encodeShareLinkResult([chart])
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const names = fields.map((f) => f.name)
      const decoded = decodeShareLink(result.param, names) as unknown[] | undefined
      expect(decoded).toBeDefined()
      const rehydrated = withFieldCatalogue(decoded!, gwFields) as {
        encodings: { dimensions: unknown; measures: unknown }
      }[]
      const expectedCatalogue = newChart(gwFields, 'Chart 1', 'gw_g054').encodings
      expect(rehydrated[0].encodings.dimensions).toEqual(expectedCatalogue.dimensions)
      expect(rehydrated[0].encodings.measures).toEqual(expectedCatalogue.measures)
    },
  )
})
