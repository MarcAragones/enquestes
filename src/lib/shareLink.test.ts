import { describe, expect, it } from 'vitest'
import {
  SHARE_PARAM,
  SHARE_VERSION,
  MAX_SHARE_PARAM_LENGTH,
  encodeShareLink,
  encodeShareLinkResult,
  decodeShareLink,
} from './shareLink'

// Illustrative fixture field names, not a pointer to any file on disk — the
// synthetic dataset these were originally drawn from was retired in plan
// 05-01. These strings are opaque identifiers for this decoder-contract
// suite; real published field names are covered separately, grounded in the
// actually-published survey data, in src/lib/realSurveys.test.ts.
const KNOWN_FIELDS = ['edat', 'satisfaccio', 'recomanaria', 'segment', 'canal', 'territori']

// GraphicWalker's own internal virtual field ids (node_modules/@kanaries/graphic-walker/dist/constants.js),
// unconditionally appended to every chart's field catalogue by newChart()/createCountField()/createVirtualFields().
// They never appear in any survey's meta.json, by design.
const GW_COUNT_FID = 'gw_count_fid'
const GW_MEA_KEY_FID = 'gw_mea_key_fid'
const GW_MEA_VAL_FID = 'gw_mea_val_fid'

/** Minimal shape of a GraphicWalker `IViewField`-like catalogue/shelf entry, for test fixtures only. */
type SpecField = { fid: string; name: string; semanticType: string; analyticType: string }
/** A shelf-assigned filter field additionally carries a `rule`. */
type SpecFilterField = SpecField & { rule: { type: string; value: string[] } }

/**
 * A GraphicWalker `VizSpecStore.exportCode()`-shaped chart, wrapped in the
 * array `exportCode()` actually returns (and that `ExplorerPage` passes
 * straight through to the `chart` prop). The `encodings.dimensions`/`measures`
 * arrays model the FULL field catalogue GraphicWalker always emits — the six
 * real survey fields plus its three virtual field ids — independently of
 * which fields are actually assigned to shelf channels (segment on columns,
 * satisfaccio on rows, canal on color, territori on filters).
 */
function makeSpec(overrides: Partial<{ territoriValue: string }> = {}) {
  const territoriValue = overrides.territoriValue ?? 'Barcelonès'
  return [
    {
      visId: 'gw_test',
      name: 'Test chart',
      encodings: {
        // Catalogue: every field available in the dataset, not shelf assignments.
        dimensions: [
          { fid: 'segment', name: 'segment', semanticType: 'nominal', analyticType: 'dimension' },
          { fid: 'canal', name: 'canal', semanticType: 'nominal', analyticType: 'dimension' },
          { fid: 'territori', name: 'territori', semanticType: 'nominal', analyticType: 'dimension' },
          { fid: GW_MEA_KEY_FID, name: 'Measure names', semanticType: 'nominal', analyticType: 'dimension' },
        ] as SpecField[],
        measures: [
          { fid: 'edat', name: 'edat', semanticType: 'quantitative', analyticType: 'measure' },
          { fid: 'satisfaccio', name: 'satisfaccio', semanticType: 'quantitative', analyticType: 'measure' },
          { fid: 'recomanaria', name: 'recomanaria', semanticType: 'quantitative', analyticType: 'measure' },
          { fid: GW_COUNT_FID, name: 'Number of records', semanticType: 'quantitative', analyticType: 'measure' },
          { fid: GW_MEA_VAL_FID, name: 'Measure values', semanticType: 'quantitative', analyticType: 'measure' },
        ] as SpecField[],
        // Shelf channels: what the chart actually uses.
        rows: [
          { fid: 'satisfaccio', name: 'satisfaccio', semanticType: 'quantitative', analyticType: 'measure' },
        ] as SpecField[],
        columns: [{ fid: 'segment', name: 'segment', semanticType: 'nominal', analyticType: 'dimension' }] as SpecField[],
        color: [{ fid: 'canal', name: 'canal', semanticType: 'nominal', analyticType: 'dimension' }] as SpecField[],
        opacity: [] as SpecField[],
        size: [] as SpecField[],
        shape: [] as SpecField[],
        theta: [] as SpecField[],
        radius: [] as SpecField[],
        longitude: [] as SpecField[],
        latitude: [] as SpecField[],
        geoId: [] as SpecField[],
        details: [] as SpecField[],
        filters: [
          {
            fid: 'territori',
            name: 'territori',
            semanticType: 'nominal',
            analyticType: 'dimension',
            rule: { type: 'one of', value: [territoriValue] },
          },
        ] as SpecFilterField[],
        text: [] as SpecField[],
      },
      config: { geoms: ['point'] },
      layout: {},
    },
  ]
}

describe('shareLink module constants', () => {
  it('exports SHARE_PARAM as "chart"', () => {
    expect(SHARE_PARAM).toBe('chart')
  })

  it('exports SHARE_VERSION as "v1"', () => {
    expect(SHARE_VERSION).toBe('v1')
  })

  it('exports MAX_SHARE_PARAM_LENGTH as 4096', () => {
    expect(MAX_SHARE_PARAM_LENGTH).toBe(4096)
  })
})

/**
 * `makeSpec()`'s shape with `encodings.dimensions`/`measures` removed — the
 * contract `decodeShareLink` returns after Task 1's encode-side catalogue
 * strip (G-05-4). Every other key (shelf channels, `visId`, `name`,
 * `config`, `layout`) round-trips unchanged.
 */
function withoutCatalogue(spec: ReturnType<typeof makeSpec>): unknown {
  return spec.map((chart) => {
    const restEncodings: Record<string, unknown> = { ...chart.encodings }
    delete restEncodings.dimensions
    delete restEncodings.measures
    return { ...chart, encodings: restEncodings }
  })
}

describe('encodeShareLink', () => {
  it('starts with the version tag followed by a separator', () => {
    const encoded = encodeShareLink(makeSpec())
    expect(encoded).not.toBeNull()
    expect(encoded!.startsWith(`${SHARE_VERSION}.`)).toBe(true)
  })

  it('returns null (not a throw) when handed a value that cannot be JSON-serialised', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(() => encodeShareLink(cyclic)).not.toThrow()
    expect(encodeShareLink(cyclic)).toBeNull()
  })

  it('strips the field catalogue so a huge-catalogue/small-shelf spec still fits the cap', () => {
    const spec = makeSpec()
    // Blow up the catalogue arrays only — shelves stay exactly as makeSpec built them.
    for (let i = 0; i < 2000; i++) {
      spec[0].encodings.dimensions.push({
        fid: `camp_catalogat_${i}`,
        name: `Camp catalogat ${i}`,
        semanticType: 'nominal',
        analyticType: 'dimension',
      })
    }
    const rawJsonLength = JSON.stringify(spec).length
    expect(rawJsonLength).toBeGreaterThan(MAX_SHARE_PARAM_LENGTH)
    const result = encodeShareLinkResult(spec)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.param.length).toBeLessThanOrEqual(MAX_SHARE_PARAM_LENGTH)
    }
  })
})

describe('encodeShareLinkResult', () => {
  it('returns { ok: false, reason: "too-long", length } when the SHELF content alone exceeds the cap', () => {
    const spec = makeSpec()
    spec[0].encodings.filters[0].rule = {
      type: 'one of',
      value: Array.from({ length: 5000 }, (_, i) => `valor_de_filtre_molt_llarg_${i}`),
    }
    const result = encodeShareLinkResult(spec)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('too-long')
      if (result.reason === 'too-long') {
        expect(result.length).toBeGreaterThan(MAX_SHARE_PARAM_LENGTH)
      }
    }
    expect(encodeShareLink(spec)).toBeNull()
  })

  it('returns { ok: false, reason: "unserializable" } for a cyclic value', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const result = encodeShareLinkResult(cyclic)
    expect(result).toEqual({ ok: false, reason: 'unserializable' })
    expect(encodeShareLink(cyclic)).toBeNull()
  })

  it('returns { ok: true, param } for a small chart', () => {
    const result = encodeShareLinkResult(makeSpec())
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.param.startsWith(`${SHARE_VERSION}.`)).toBe(true)
    }
  })
})

describe('decodeShareLink round trip', () => {
  it('round-trips a representative spec (fields, mark, filter) losslessly, minus the stripped field catalogue', () => {
    const spec = makeSpec()
    const encoded = encodeShareLink(spec)
    expect(encoded).not.toBeNull()
    const decoded = decodeShareLink(encoded, KNOWN_FIELDS)
    expect(decoded).toEqual(withoutCatalogue(spec))
  })

  it('round-trips accented Catalan filter text byte-identically (UTF-8 safety)', () => {
    const spec = makeSpec({ territoriValue: 'Baix Llobregat, àèìòù çÇ ñÑ' })
    const encoded = encodeShareLink(spec)
    const decoded = decodeShareLink(encoded, KNOWN_FIELDS) as ReturnType<typeof withoutCatalogue> as ReturnType<
      typeof makeSpec
    >
    expect(decoded).toEqual(withoutCatalogue(spec))
    expect((decoded[0].encodings.filters[0].rule as { value: string[] }).value[0]).toBe(
      'Baix Llobregat, àèìòù çÇ ñÑ'
    )
  })

  it('round-trips a chart that places a GraphicWalker virtual field on a shelf (e.g. Number of records on rows)', () => {
    const spec = makeSpec()
    // Replace the "satisfaccio on rows" assignment with the virtual count field —
    // dragging "Number of records" onto an axis is an ordinary, common action.
    spec[0].encodings.rows = [
      { fid: GW_COUNT_FID, name: 'Number of records', semanticType: 'quantitative', analyticType: 'measure' },
    ]
    const encoded = encodeShareLink(spec)
    expect(encoded).not.toBeNull()
    const decoded = decodeShareLink(encoded, KNOWN_FIELDS)
    expect(decoded).toEqual(withoutCatalogue(spec))
  })

  it('accepts a spec whose catalogue lists a stale field absent from knownFieldNames, as long as every shelf holds only known fields', () => {
    const spec = makeSpec()
    // A field the current survey has since dropped, still listed in the
    // catalogue from when the sharer's dataset had it — but never shelved.
    // The catalogue never reaches the encoded payload at all (it is
    // stripped before encoding), so this only proves the stale entry never
    // blocks the round trip.
    spec[0].encodings.dimensions.push({
      fid: 'antiga_columna_eliminada',
      name: 'antiga_columna_eliminada',
      semanticType: 'nominal',
      analyticType: 'dimension',
    })
    const encoded = encodeShareLink(spec)
    expect(encoded).not.toBeNull()
    const decoded = decodeShareLink(encoded, KNOWN_FIELDS)
    expect(decoded).toEqual(withoutCatalogue(spec))
  })

  it('back-compat: a hand-built under-cap v1 payload carrying a full foreign catalogue still decodes (decoder untouched)', () => {
    // Bypasses encodeShareLink deliberately — the new encoder can no longer
    // produce a payload that carries dimensions/measures, but a legacy link
    // shared before this change could. Proves decodeShareLink's validation
    // (steps 1-7) was not weakened by the encode-side change.
    const legacySpec = [
      {
        visId: 'gw_legacy',
        name: 'Legacy chart',
        encodings: {
          dimensions: [
            { fid: 'un_camp_foraster', name: 'un_camp_foraster', semanticType: 'nominal', analyticType: 'dimension' },
          ],
          measures: [],
          rows: [],
          columns: [{ fid: 'segment', name: 'segment', semanticType: 'nominal', analyticType: 'dimension' }],
          color: [],
          opacity: [],
          size: [],
          shape: [],
          theta: [],
          radius: [],
          longitude: [],
          latitude: [],
          geoId: [],
          details: [],
          filters: [],
          text: [],
        },
        config: {},
        layout: {},
      },
    ]
    const json = JSON.stringify(legacySpec)
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    const base64url = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const payload = `v1.${base64url}`
    expect(payload.length).toBeLessThanOrEqual(MAX_SHARE_PARAM_LENGTH)
    const decoded = decodeShareLink(payload, KNOWN_FIELDS)
    expect(decoded).toBeDefined()
    expect(decoded).toEqual(legacySpec)
  })
})

describe('decodeShareLink hostile/stale input handling', () => {
  it('returns undefined for null input', () => {
    expect(decodeShareLink(null, KNOWN_FIELDS)).toBeUndefined()
  })

  it('returns undefined for empty string input', () => {
    expect(decodeShareLink('', KNOWN_FIELDS)).toBeUndefined()
  })

  it('returns undefined for null/empty input even with an empty known-fields list', () => {
    expect(decodeShareLink(null, [])).toBeUndefined()
    expect(decodeShareLink('', [])).toBeUndefined()
  })

  it('returns undefined for a raw param longer than MAX_SHARE_PARAM_LENGTH, short-circuiting before decode work', () => {
    const oversized = 'v1.' + 'a'.repeat(MAX_SHARE_PARAM_LENGTH + 100)
    expect(oversized.length).toBeGreaterThan(MAX_SHARE_PARAM_LENGTH)
    expect(() => decodeShareLink(oversized, KNOWN_FIELDS)).not.toThrow()
    expect(decodeShareLink(oversized, KNOWN_FIELDS)).toBeUndefined()
  })

  it('returns undefined for an unrecognised version tag without throwing', () => {
    const encoded = encodeShareLink(makeSpec())!
    const wrongVersion = encoded.replace(/^v1\./, 'v2.')
    expect(() => decodeShareLink(wrongVersion, KNOWN_FIELDS)).not.toThrow()
    expect(decodeShareLink(wrongVersion, KNOWN_FIELDS)).toBeUndefined()
  })

  it('returns undefined for a payload of arbitrary non-base64 characters without throwing', () => {
    const malformed = 'v1.!!!not-valid-base64!!!$$$'
    expect(() => decodeShareLink(malformed, KNOWN_FIELDS)).not.toThrow()
    expect(decodeShareLink(malformed, KNOWN_FIELDS)).toBeUndefined()
  })

  it('returns undefined for a correctly-base64-decoded payload that is not valid JSON', () => {
    // "not json at all" encoded to base64url, prefixed with the real version tag.
    const notJson = btoa('this is not json {{{')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const payload = `v1.${notJson}`
    expect(() => decodeShareLink(payload, KNOWN_FIELDS)).not.toThrow()
    expect(decodeShareLink(payload, KNOWN_FIELDS)).toBeUndefined()
  })

  it('returns undefined for a spec referencing a field name absent from knownFieldNames', () => {
    // Restricting knownFieldNames to just segment/canal makes satisfaccio (rows)
    // and territori (filters) — both shelf-assigned in makeSpec() — unknown.
    // This is a genuine shelf-level rejection: the T-03-11 control still bites
    // on any shelf reference outside knownFieldNames, not merely a stale catalogue.
    const spec = makeSpec()
    const encoded = encodeShareLink(spec)!
    expect(() => decodeShareLink(encoded, ['segment', 'canal'])).not.toThrow()
    expect(decodeShareLink(encoded, ['segment', 'canal'])).toBeUndefined()
  })

  it('returns undefined for a spec that places a field absent from knownFieldNames directly on a shelf channel', () => {
    const spec = makeSpec()
    spec[0].encodings.size = [
      { fid: 'camp_desconegut', name: 'camp_desconegut', semanticType: 'quantitative', analyticType: 'measure' },
    ]
    const encoded = encodeShareLink(spec)!
    expect(() => decodeShareLink(encoded, KNOWN_FIELDS)).not.toThrow()
    expect(decodeShareLink(encoded, KNOWN_FIELDS)).toBeUndefined()
  })

  it('never throws for any hostile input class exercised above', () => {
    const inputs = [
      null,
      '',
      'v1.' + 'a'.repeat(MAX_SHARE_PARAM_LENGTH + 100),
      'v2.abc',
      'v1.!!!not-valid-base64!!!',
      'v1.' + btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    ]
    for (const input of inputs) {
      expect(() => decodeShareLink(input, KNOWN_FIELDS)).not.toThrow()
    }
  })
})
