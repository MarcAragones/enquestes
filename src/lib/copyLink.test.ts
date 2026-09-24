import { describe, expect, it } from 'vitest'
import {
  buildShareUrl,
  SHARE_TOO_LONG_MESSAGE,
  SHARE_ENCODE_FAILED_MESSAGE,
  CLIPBOARD_FAILED_MESSAGE,
} from './copyLink'
import { SHARE_PARAM, encodeShareLinkResult } from './shareLink'

/** Minimal chart-like fixture, small enough to always fit under the cap. */
function makeSmallChart() {
  return [
    {
      visId: 'gw_test',
      name: 'Test chart',
      encodings: {
        dimensions: [],
        measures: [],
        rows: [{ fid: 'satisfaccio', name: 'satisfaccio', semanticType: 'quantitative', analyticType: 'measure' }],
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
}

/** A chart whose shelf content alone (not just its catalogue) exceeds the cap. */
function makeOverCapChart() {
  const chart = makeSmallChart()
  chart[0].encodings.filters = [
    {
      fid: 'territori',
      name: 'territori',
      semanticType: 'nominal',
      analyticType: 'dimension',
      rule: { type: 'one of', value: Array.from({ length: 5000 }, (_, i) => `valor_${i}`) },
    },
  ] as unknown as (typeof chart)[0]['encodings']['filters']
  return chart
}

describe('buildShareUrl', () => {
  it('returns { ok: true, url } keeping the original path and pre-existing unrelated query params', () => {
    const outcome = buildShareUrl('https://example.github.io/enquestes/enquesta/REO1151?foo=bar', makeSmallChart())
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const url = new URL(outcome.url)
    expect(url.pathname).toBe('/enquestes/enquesta/REO1151')
    expect(url.searchParams.get('foo')).toBe('bar')
  })

  it("its chart param equals the value encodeShareLinkResult produced", () => {
    const chart = makeSmallChart()
    const result = encodeShareLinkResult(chart)
    expect(result.ok).toBe(true)
    const outcome = buildShareUrl('https://example.github.io/enquestes/enquesta/REO1151', chart)
    expect(outcome.ok).toBe(true)
    if (!outcome.ok || !result.ok) return
    const url = new URL(outcome.url)
    expect(url.searchParams.get(SHARE_PARAM)).toBe(result.param)
  })

  it('replaces an existing chart param rather than appending a second one', () => {
    const outcome = buildShareUrl(
      'https://example.github.io/enquestes/enquesta/REO1151?chart=v1.old-stale-value',
      makeSmallChart(),
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const url = new URL(outcome.url)
    expect(url.searchParams.getAll(SHARE_PARAM)).toHaveLength(1)
    expect(url.searchParams.get(SHARE_PARAM)).not.toBe('v1.old-stale-value')
  })

  it('returns { ok: false, message: SHARE_TOO_LONG_MESSAGE } for a chart whose shelves alone exceed the cap', () => {
    const outcome = buildShareUrl('https://example.github.io/enquestes/enquesta/REO1151', makeOverCapChart())
    expect(outcome).toEqual({ ok: false, message: SHARE_TOO_LONG_MESSAGE })
  })

  it('returns { ok: false, message: SHARE_ENCODE_FAILED_MESSAGE } for a cyclic value', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const outcome = buildShareUrl('https://example.github.io/enquestes/enquesta/REO1151', cyclic)
    expect(outcome).toEqual({ ok: false, message: SHARE_ENCODE_FAILED_MESSAGE })
  })

  it('returns the encode-failed outcome, not a throw, for a malformed href', () => {
    expect(() => buildShareUrl('not a valid url at all', makeSmallChart())).not.toThrow()
    const outcome = buildShareUrl('not a valid url at all', makeSmallChart())
    expect(outcome).toEqual({ ok: false, message: SHARE_ENCODE_FAILED_MESSAGE })
  })

  it('never throws for any of the inputs above', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const cases: [string, unknown][] = [
      ['https://example.github.io/enquestes/enquesta/REO1151', makeSmallChart()],
      ['https://example.github.io/enquestes/enquesta/REO1151', makeOverCapChart()],
      ['https://example.github.io/enquestes/enquesta/REO1151', cyclic],
      ['not a valid url at all', makeSmallChart()],
    ]
    for (const [href, spec] of cases) {
      expect(() => buildShareUrl(href, spec)).not.toThrow()
    }
  })
})

describe('copyLink message constants', () => {
  it('are non-empty Catalan prose naming no field name, cap value, or internal identifier', () => {
    for (const message of [SHARE_TOO_LONG_MESSAGE, SHARE_ENCODE_FAILED_MESSAGE, CLIPBOARD_FAILED_MESSAGE]) {
      expect(message.length).toBeGreaterThan(0)
      expect(message).not.toMatch(/4096|MAX_SHARE_PARAM_LENGTH/)
      expect(message).not.toMatch(/\bfid\b|gw_count_fid|gw_mea_key_fid|gw_mea_val_fid/)
    }
  })
})
