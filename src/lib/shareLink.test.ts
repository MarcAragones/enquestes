import { describe, expect, it } from 'vitest'
import {
  SHARE_PARAM,
  SHARE_VERSION,
  MAX_SHARE_PARAM_LENGTH,
  encodeShareLink,
  decodeShareLink,
} from './shareLink'

// Real mostra-sintetica field names (public/data/enquestes/mostra-sintetica_meta.json).
const KNOWN_FIELDS = ['edat', 'satisfaccio', 'recomanaria', 'segment', 'canal', 'territori']

// A representative GraphicWalker IChart-shaped spec: field references (fid),
// a mark type (config.geoms), and an active filter with an accented value.
function makeSpec(overrides: Partial<{ territoriValue: string }> = {}) {
  const territoriValue = overrides.territoriValue ?? 'Barcelonès'
  return {
    visId: 'gw_test',
    name: 'Test chart',
    encodings: {
      dimensions: [{ fid: 'segment', name: 'segment', semanticType: 'nominal', analyticType: 'dimension' }],
      measures: [{ fid: 'satisfaccio', name: 'satisfaccio', semanticType: 'quantitative', analyticType: 'measure' }],
      rows: [],
      columns: [],
      color: [{ fid: 'canal', name: 'canal', semanticType: 'nominal', analyticType: 'dimension' }],
      opacity: [],
      size: [],
      shape: [],
      theta: [],
      radius: [],
      longitude: [],
      latitude: [],
      geoId: [],
      details: [],
      filters: [
        {
          fid: 'territori',
          name: 'territori',
          semanticType: 'nominal',
          analyticType: 'dimension',
          rule: { type: 'one of', value: [territoriValue] },
        },
      ],
      text: [],
    },
    config: { geoms: ['point'] },
    layout: {},
  }
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
})

describe('decodeShareLink round trip', () => {
  it('round-trips a representative spec (fields, mark, filter) losslessly', () => {
    const spec = makeSpec()
    const encoded = encodeShareLink(spec)
    expect(encoded).not.toBeNull()
    const decoded = decodeShareLink(encoded, KNOWN_FIELDS)
    expect(decoded).toEqual(spec)
  })

  it('round-trips accented Catalan filter text byte-identically (UTF-8 safety)', () => {
    const spec = makeSpec({ territoriValue: 'Baix Llobregat, àèìòù çÇ ñÑ' })
    const encoded = encodeShareLink(spec)
    const decoded = decodeShareLink(encoded, KNOWN_FIELDS) as ReturnType<typeof makeSpec>
    expect(decoded).toEqual(spec)
    expect((decoded.encodings.filters[0].rule as { value: string[] }).value[0]).toBe(
      'Baix Llobregat, àèìòù çÇ ñÑ'
    )
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
    const spec = makeSpec()
    const encoded = encodeShareLink(spec)!
    expect(() => decodeShareLink(encoded, ['segment', 'canal'])).not.toThrow()
    expect(decodeShareLink(encoded, ['segment', 'canal'])).toBeUndefined()
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
