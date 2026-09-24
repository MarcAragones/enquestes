import type { GraphicWalkerField } from './graphicWalkerFields'

/**
 * Receive-side rehydration for a decoded share-link chart (G-05-4).
 * Deliberately a SEPARATE module from `shareLink.ts` so `decodeShareLink`'s
 * Phase 3 validation sequence (length cap, version tag, UTF-8-fatal decode,
 * shape guard, shelf-fid allow-list) stays untouched — this module only
 * runs AFTER `decodeShareLink` has already returned a validated chart.
 *
 * `buildFieldCatalogue` hand-rolls the field catalogue GraphicWalker's own
 * `newChart()` builds (`node_modules/@kanaries/graphic-walker/dist/models/
 * visSpecHistory.js` lines 452-483, using `createCountField`/
 * `createVirtualFields` from `dist/utils/index.js` lines 20-51), instead of
 * importing the library helper directly: pulling
 * `@kanaries/graphic-walker/models/visSpecHistory` into PRODUCTION code
 * would add ~332 KB minified of duplicated library code to this project's
 * $0-budget static bundle (it currently reaches the browser only as a
 * test-only import, via the package's supported `./*` export-map subpath,
 * which resolves under vitest's `environment: 'node'` but is never bundled
 * for the browser). `shareChartCatalogue.test.ts` pins this hand-rolled
 * output against the library's real `newChart()` output, so a future
 * `@kanaries/graphic-walker` upgrade that changes the catalogue shape fails
 * loudly in that test instead of silently emptying a restored chart's field
 * panel in the browser (T-05-16).
 */

/** GraphicWalker's own internal virtual field ids (dist/constants.js). */
const COUNT_FIELD_ID = 'gw_count_fid'
const MEA_KEY_ID = 'gw_mea_key_fid'
const MEA_VAL_ID = 'gw_mea_val_fid'

interface CatalogueEntry {
  fid: string
  name?: string
  basename?: string
  semanticType: string
  analyticType: 'dimension' | 'measure'
  aggName?: string
  computed?: boolean
  expression?: { op: string; params: unknown[]; as: string }
}

/**
 * Mirrors `createCountField()` (dist/utils/index.js). Its `name` is
 * produced there via `i18next.t('constant.row_count')`; this project never
 * initialises i18next (GraphicWalker's own field-panel rendering resolves a
 * field's display label separately, by `fid`, not from this stored `name`),
 * so the name is intentionally left unset here, matching what the
 * installed library itself produces in this app's actual runtime — pinned
 * by `shareChartCatalogue.test.ts`.
 */
function countField(): CatalogueEntry {
  return {
    fid: COUNT_FIELD_ID,
    analyticType: 'measure',
    semanticType: 'quantitative',
    aggName: 'sum',
    computed: true,
    expression: { op: 'one', params: [], as: COUNT_FIELD_ID },
  }
}

/** Mirrors the "Measure names" virtual entry from `createVirtualFields()`. */
function measureNamesField(): CatalogueEntry {
  return { fid: MEA_KEY_ID, analyticType: 'dimension', semanticType: 'nominal' }
}

/** Mirrors the "Measure values" virtual entry from `createVirtualFields()`. */
function measureValuesField(): CatalogueEntry {
  return { fid: MEA_VAL_ID, analyticType: 'measure', semanticType: 'quantitative', aggName: 'sum' }
}

/**
 * Rebuilds the field catalogue `newChart()` would build for `fields`:
 * dimensions (real dimension fields, then the "Measure names" virtual
 * entry) and measures (real measure fields with `aggName: 'sum'`, then the
 * count virtual entry, then the "Measure values" virtual entry) — in that
 * order, matching the library exactly. Mirrors `newChart`'s empty-input
 * branch: an empty field list yields empty arrays and NO virtual entries.
 */
export function buildFieldCatalogue(fields: GraphicWalkerField[]): {
  dimensions: CatalogueEntry[]
  measures: CatalogueEntry[]
} {
  if (fields.length === 0) {
    return { dimensions: [], measures: [] }
  }

  const dimensions: CatalogueEntry[] = fields
    .filter((f) => f.analyticType === 'dimension')
    .map((f) => ({
      fid: f.fid,
      name: f.name || f.fid,
      basename: f.name || f.fid,
      semanticType: f.semanticType,
      analyticType: f.analyticType,
    }))
  dimensions.push(measureNamesField())

  const measures: CatalogueEntry[] = fields
    .filter((f) => f.analyticType === 'measure')
    .map((f) => ({
      fid: f.fid,
      name: f.name || f.fid,
      basename: f.name || f.fid,
      analyticType: f.analyticType,
      semanticType: f.semanticType,
      aggName: 'sum',
    }))
  measures.push(countField(), measureValuesField())

  return { dimensions, measures }
}

/**
 * Returns each chart in `charts` with `encodings.dimensions`/`.measures`
 * REPLACED — unconditionally, whether or not the decoded payload carried a
 * catalogue at all — by `buildFieldCatalogue(fields)`. Unconditional
 * replacement is deliberate: it makes the restored catalogue the currently
 * loaded survey's own by construction, so a stale or crafted share-link
 * payload can never inject a foreign or nonexistent field pill into the
 * field panel (T-05-13, strengthening T-03-11's shelf-only allow-list), and
 * it means even a legacy under-cap link that DID carry a full catalogue
 * gets a correct, freshly-built one instead of a stale one. Every other
 * key — all shelf channels, `visId`, `name`, `config`, `layout` — is left
 * untouched. An element that is not a non-null, non-array object with a
 * non-null, non-array `encodings` is returned as-is, never thrown on.
 */
export function withFieldCatalogue(charts: unknown[], fields: GraphicWalkerField[]): unknown[] {
  const catalogue = buildFieldCatalogue(fields)
  return charts.map((chart) => {
    if (chart === null || typeof chart !== 'object' || Array.isArray(chart)) {
      return chart
    }
    const candidate = chart as Record<string, unknown>
    const encodings = candidate.encodings
    if (encodings === null || typeof encodings !== 'object' || Array.isArray(encodings)) {
      return chart
    }
    return {
      ...candidate,
      encodings: {
        ...(encodings as Record<string, unknown>),
        dimensions: catalogue.dimensions,
        measures: catalogue.measures,
      },
    }
  })
}
