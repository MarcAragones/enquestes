import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildFieldCatalogue, withFieldCatalogue } from './shareChartCatalogue'
import { toGraphicWalkerFields } from './graphicWalkerFields'
import { parseEnquestaMeta, parseEnquestesIndex } from './enquestes'
import type { GraphicWalkerField } from './graphicWalkerFields'
import type { EnquestaMeta } from '../types/enquesta'
// Test-only, per shareChartCatalogue.ts's doc comment: importing this
// subpath into PRODUCTION code would add ~332 KB minified of duplicated
// library code to this project's $0-budget bundle. This suite exists so a
// future @kanaries/graphic-walker upgrade that changes the catalogue shape
// fails loudly HERE, instead of silently emptying a restored chart's field
// panel in the browser.
import { newChart } from '@kanaries/graphic-walker/models/visSpecHistory'

/**
 * Drift pin: `buildFieldCatalogue` (shareChartCatalogue.ts) hand-rolls what
 * the installed library's own `newChart()` builds, to avoid importing the
 * library into the production bundle. This suite proves the two stay in
 * sync — restricted to `dimensions`/`measures`, the only two keys
 * `buildFieldCatalogue` produces.
 */
function libraryCatalogue(fields: GraphicWalkerField[]) {
  const { dimensions, measures } = newChart(fields, 'Chart 1').encodings
  return { dimensions, measures }
}

const MIXED_FIELDS: GraphicWalkerField[] = [
  { fid: 'edat', name: 'edat', semanticType: 'quantitative', analyticType: 'measure' },
  { fid: 'satisfaccio', name: 'satisfaccio', semanticType: 'quantitative', analyticType: 'measure' },
  { fid: 'segment', name: 'segment', semanticType: 'nominal', analyticType: 'dimension' },
  { fid: 'canal', name: 'canal', semanticType: 'nominal', analyticType: 'dimension' },
]

const DIMENSION_ONLY_FIELDS: GraphicWalkerField[] = [
  { fid: 'segment', name: 'segment', semanticType: 'nominal', analyticType: 'dimension' },
  { fid: 'canal', name: 'canal', semanticType: 'nominal', analyticType: 'dimension' },
]

const MEASURE_ONLY_FIELDS: GraphicWalkerField[] = [
  { fid: 'edat', name: 'edat', semanticType: 'quantitative', analyticType: 'measure' },
  { fid: 'satisfaccio', name: 'satisfaccio', semanticType: 'quantitative', analyticType: 'measure' },
]

// Real published survey with the most fields — read from public/data/ the
// way realSurveys.test.ts does, never hardcoded to a specific survey id.
const indexPath = join(process.cwd(), 'public/data/enquestes_index.json')
const rawIndex: unknown = JSON.parse(readFileSync(indexPath, 'utf-8'))
const index = parseEnquestesIndex(rawIndex)
const metas: EnquestaMeta[] = index.map((entry) => {
  const metaPath = join(process.cwd(), 'public/data/enquestes', `${entry.id}_meta.json`)
  const rawMeta: unknown = JSON.parse(readFileSync(metaPath, 'utf-8'))
  return parseEnquestaMeta(rawMeta)
})
const widestMeta = metas.reduce((widest, meta) =>
  (meta.fields?.length ?? 0) > (widest.fields?.length ?? 0) ? meta : widest,
)
const widestFields = toGraphicWalkerFields(widestMeta.fields ?? [])

describe('buildFieldCatalogue drift pin against the installed library', () => {
  it("deep-equals newChart's own catalogue for a mixed dimension/measure field list — same entries, order, and per-entry keys", () => {
    expect(buildFieldCatalogue(MIXED_FIELDS)).toEqual(libraryCatalogue(MIXED_FIELDS))
  })

  it("deep-equals newChart's own catalogue for the real published survey with the most fields", () => {
    expect(widestFields.length).toBeGreaterThan(0)
    expect(buildFieldCatalogue(widestFields)).toEqual(libraryCatalogue(widestFields))
  })

  it('matches the count entry\'s computed flag and expression exactly', () => {
    const { measures } = buildFieldCatalogue(MIXED_FIELDS)
    const countEntry = measures.find((m) => m.fid === 'gw_count_fid')
    expect(countEntry).toMatchObject({
      computed: true,
      expression: { op: 'one', params: [], as: 'gw_count_fid' },
    })
  })

  it('yields empty arrays with no virtual entries for an empty field list, matching newChart\'s empty-input branch', () => {
    expect(buildFieldCatalogue([])).toEqual({ dimensions: [], measures: [] })
    expect(libraryCatalogue([])).toEqual({ dimensions: [], measures: [] })
  })

  it('a dimension-only field list still receives the correct virtual entries on both sides', () => {
    const result = buildFieldCatalogue(DIMENSION_ONLY_FIELDS)
    expect(result).toEqual(libraryCatalogue(DIMENSION_ONLY_FIELDS))
    expect(result.dimensions.map((d) => d.fid)).toEqual(['segment', 'canal', 'gw_mea_key_fid'])
    expect(result.measures.map((m) => m.fid)).toEqual(['gw_count_fid', 'gw_mea_val_fid'])
  })

  it('a measure-only field list still receives the correct virtual entries on both sides', () => {
    const result = buildFieldCatalogue(MEASURE_ONLY_FIELDS)
    expect(result).toEqual(libraryCatalogue(MEASURE_ONLY_FIELDS))
    expect(result.dimensions.map((d) => d.fid)).toEqual(['gw_mea_key_fid'])
    expect(result.measures.map((m) => m.fid)).toEqual(['edat', 'satisfaccio', 'gw_count_fid', 'gw_mea_val_fid'])
  })
})

describe('withFieldCatalogue', () => {
  function makeChart(overrideDimensions: unknown[]) {
    return {
      visId: 'gw_test',
      name: 'Test chart',
      encodings: {
        dimensions: overrideDimensions,
        measures: [],
        rows: [{ fid: 'edat', name: 'edat', semanticType: 'quantitative', analyticType: 'measure' }],
        columns: [{ fid: 'segment', name: 'segment', semanticType: 'nominal', analyticType: 'dimension' }],
        filters: [],
      },
      config: { geoms: ['point'] },
      layout: {},
    }
  }

  it('overwrites a catalogue the payload already carried, removing a field absent from the survey, leaving every other key untouched', () => {
    const foreignField = { fid: 'camp_foraster', name: 'camp_foraster', semanticType: 'nominal', analyticType: 'dimension' }
    const chart = makeChart([foreignField])
    const [rehydrated] = withFieldCatalogue([chart], MIXED_FIELDS) as [typeof chart]

    const dimensionFids = (rehydrated.encodings.dimensions as { fid: string }[]).map((d) => d.fid)
    expect(dimensionFids).not.toContain('camp_foraster')
    expect(rehydrated.encodings.dimensions).toEqual(buildFieldCatalogue(MIXED_FIELDS).dimensions)
    expect(rehydrated.encodings.measures).toEqual(buildFieldCatalogue(MIXED_FIELDS).measures)

    // Every other key is byte-identical to the input.
    expect(rehydrated.visId).toBe(chart.visId)
    expect(rehydrated.name).toBe(chart.name)
    expect(rehydrated.config).toEqual(chart.config)
    expect(rehydrated.layout).toEqual(chart.layout)
    expect(rehydrated.encodings.rows).toEqual(chart.encodings.rows)
    expect(rehydrated.encodings.columns).toEqual(chart.encodings.columns)
    expect(rehydrated.encodings.filters).toEqual(chart.encodings.filters)
  })

  it('is idempotent — applying it twice equals applying it once', () => {
    const chart = makeChart([])
    const once = withFieldCatalogue([chart], MIXED_FIELDS)
    const twice = withFieldCatalogue(once, MIXED_FIELDS)
    expect(twice).toEqual(once)
  })

  it('leaves a non-object element untouched without throwing', () => {
    const inputs: unknown[] = [null, 42, 'not a chart', ['also not a chart']]
    expect(() => withFieldCatalogue(inputs, MIXED_FIELDS)).not.toThrow()
    expect(withFieldCatalogue(inputs, MIXED_FIELDS)).toEqual(inputs)
  })

  it('leaves an encodings-less object untouched without throwing', () => {
    const noEncodings = { visId: 'gw_test', name: 'No encodings' }
    expect(() => withFieldCatalogue([noEncodings], MIXED_FIELDS)).not.toThrow()
    expect(withFieldCatalogue([noEncodings], MIXED_FIELDS)).toEqual([noEncodings])
  })
})
