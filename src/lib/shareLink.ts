/** Query-param name the shared chart spec travels under, e.g. `?chart=v1.xxxx`. */
export const SHARE_PARAM = 'chart'

/**
 * Wire-format version tag prefixed to every encoded payload. A future format
 * change adds a new decoder for a new tag rather than breaking every link
 * already shared into the wild — this build only ever emits and accepts
 * this exact tag.
 */
export const SHARE_VERSION = 'v1'

/** Single-character separator between the version tag and the payload. */
const SEPARATOR = '.'

/**
 * Hard cap on the accepted raw query-param length, enforced as the very
 * first check in decodeShareLink — before any base64/JSON work — so an
 * oversized crafted payload cannot cost more than a length comparison
 * (Denial of Service guard, T-03-12).
 */
export const MAX_SHARE_PARAM_LENGTH = 4096

/** Converts a standard-base64 string to the URL-safe base64url alphabet. */
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Converts a base64url string back to standard base64 (re-adding padding). */
function fromBase64Url(base64url: string): string {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (base64.length % 4)) % 4
  return base64 + '='.repeat(padLength)
}

/**
 * Removes exactly `encodings.dimensions`/`encodings.measures` — the field
 * CATALOGUE, i.e. every field available in the sharer's dataset — from a
 * chart-like value, leaving every shelf channel and every other key
 * untouched. Shallow and total: never recurses into arbitrary nesting,
 * never throws (an unexpected shape is returned as-is, and any error from
 * a later step — e.g. a cyclic value — is caught by the JSON.stringify in
 * `encodeShareLinkResult`, not by this helper).
 *
 * Why strip at all (G-05-4): GraphicWalker's `VizSpecStore.exportCode()`
 * always embeds the ENTIRE field catalogue in `encodings.dimensions`/
 * `.measures`, so an encoded payload's size scaled with the survey's field
 * count (283/291/263 fields for the three published surveys) rather than
 * with chart complexity — a 291-field survey's chart serialised to a
 * ~57,357-character `chart=` param, well past what browsers/servers accept
 * (Node's default 16 KB header limit rejected it with HTTP 431 before any
 * app code ran). The catalogue is never needed on the wire: `decodeShareLink`
 * only ever inspects shelf channels (`SHELF_CHANNEL_KEYS`) against the
 * currently-loaded survey's own field list, and `shareChartCatalogue.ts`
 * rebuilds a correct catalogue from that same list on decode.
 */
function stripFieldCatalogue(spec: unknown): unknown {
  if (Array.isArray(spec)) {
    return spec.map(stripOneChartsCatalogue)
  }
  return stripOneChartsCatalogue(spec)
}

/** Strips the field catalogue off a single chart-like element, if it has one. */
function stripOneChartsCatalogue(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value
  }
  const candidate = value as Record<string, unknown>
  const encodings = candidate.encodings
  if (encodings === null || typeof encodings !== 'object' || Array.isArray(encodings)) {
    return value
  }
  const restEncodings: Record<string, unknown> = { ...(encodings as Record<string, unknown>) }
  delete restEncodings.dimensions
  delete restEncodings.measures
  return { ...candidate, encodings: restEncodings }
}

/**
 * Discriminated outcome of an encode attempt. `encodeShareLink` (below) is a
 * thin wrapper over this that collapses both failure reasons to `null`, for
 * every existing call site that only needs the null-contract; callers that
 * need to tell a visitor WHY an encode failed (the "Copia l'enllaç" click
 * handler, `src/lib/copyLink.ts`) use this richer result directly.
 */
export type EncodeShareLinkResult =
  | { ok: true; param: string }
  | { ok: false; reason: 'too-long'; length: number }
  | { ok: false; reason: 'unserializable' }

/**
 * Encodes a GraphicWalker chart spec (or spec collection) into a versioned,
 * UTF-8-safe, URL-safe string suitable for a query-param value — after
 * stripping the field catalogue (see `stripFieldCatalogue` above) and
 * enforcing `MAX_SHARE_PARAM_LENGTH` on the assembled param, the SAME
 * constant `decodeShareLink` enforces on the way in. Sharing one constant
 * for both directions is the invariant "the encoder never emits what the
 * decoder would refuse" — a second constant would let the two sides drift.
 *
 * A direct `btoa(JSON.stringify(spec))` throws on any character outside
 * Latin-1, and this survey's dimension/filter values carry accented
 * Catalan text — so the payload is routed through TextEncoder first to get
 * UTF-8 bytes, then converted to a binary string btoa can safely consume.
 */
export function encodeShareLinkResult(spec: unknown): EncodeShareLinkResult {
  const stripped = stripFieldCatalogue(spec)

  let json: string
  try {
    json = JSON.stringify(stripped)
  } catch {
    return { ok: false, reason: 'unserializable' }
  }
  if (json === undefined) {
    // JSON.stringify returns the *value* undefined (not a string) for
    // inputs like `undefined` or a bare function — treat as unencodable.
    return { ok: false, reason: 'unserializable' }
  }

  try {
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    const base64 = btoa(binary)
    const param = `${SHARE_VERSION}${SEPARATOR}${toBase64Url(base64)}`
    if (param.length > MAX_SHARE_PARAM_LENGTH) {
      return { ok: false, reason: 'too-long', length: param.length }
    }
    return { ok: true, param }
  } catch {
    return { ok: false, reason: 'unserializable' }
  }
}

/**
 * Thin wrapper over `encodeShareLinkResult`, returning `null` — never
 * throwing — for either failure reason. The caller (the "Copia l'enllaç"
 * click handler, `src/lib/copyLink.ts`) uses `encodeShareLinkResult`
 * directly when it needs to tell the visitor WHY an encode failed; every
 * other existing call site keeps this narrower null-contract unchanged.
 */
export function encodeShareLink(spec: unknown): string | null {
  const result = encodeShareLinkResult(spec)
  return result.ok ? result.param : null
}

/**
 * Structural guard for a single GraphicWalker chart spec. Both `IChart` and
 * the deprecated `IVisSpec` (the two variants `ISpecProps['chart']` accepts,
 * confirmed against the installed @kanaries/graphic-walker@0.5.2 types —
 * `dist/interfaces.d.ts`) require a non-optional `visId: string` and a
 * non-optional `encodings: DraggableFieldState` object — checking both is
 * enough to reject a decoded value that merely happens to parse as JSON
 * (a bare number, string, boolean, array element, or an object missing the
 * chart-spec shape entirely) without hardcoding a property name that isn't
 * actually part of the confirmed contract.
 */
function isChartLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.visId === 'string' &&
    typeof candidate.encodings === 'object' &&
    candidate.encodings !== null &&
    // `typeof [] === 'object'`, so without this explicit exclusion an
    // array-typed `encodings` (e.g. `{"visId":"v1","encodings":[]}`) would
    // pass this guard even though `DraggableFieldState` is never an array —
    // and `collectShelfFieldReferences` iterating `SHELF_CHANNEL_KEYS` via
    // `key in encodings` finds zero own properties on an array, silently
    // disabling the T-03-11 schema-drift check for that payload (WR-01).
    !Array.isArray(candidate.encodings)
  )
}

/** Every string value found at a `fid` key inside a parsed chart-like structure. */
function collectFieldReferences(value: unknown, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectFieldReferences(item, out)
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'fid' && typeof val === 'string') {
        out.add(val)
      } else {
        collectFieldReferences(val, out)
      }
    }
  }
}

/**
 * GraphicWalker's own internal virtual field ids (installed
 * @kanaries/graphic-walker@0.5.2, `dist/constants.js`:
 * `COUNT_FIELD_ID`/`MEA_KEY_ID`/`MEA_VAL_ID`). `newChart()`
 * (`dist/models/visSpecHistory.js`) appends these to every chart's field
 * catalogue unconditionally, whenever the dataset has any fields at all —
 * they do not come from any survey's data. A visitor can legitimately drag
 * one onto a shelf (e.g. "Number of records" onto an axis is an ordinary,
 * common action), so they are valid field references that no survey's
 * meta.json will ever list.
 */
const GRAPHIC_WALKER_VIRTUAL_FIDS = new Set(['gw_count_fid', 'gw_mea_key_fid', 'gw_mea_val_fid'])

/**
 * `DraggableFieldState` keys that represent shelf assignments — what a
 * chart actually uses — as opposed to `dimensions`/`measures`, which
 * enumerate every field available in the sharer's dataset (the field
 * CATALOGUE, not shelf content).
 *
 * Corrected mechanism (G-05-4; this replaces an earlier, inaccurate claim
 * that GraphicWalker rebuilds the catalogue from the `rawFields` prop at
 * mount time — it does not). Confirmed against the installed
 * @kanaries/graphic-walker@0.5.2 source: `ISpecProps.chart` flows through
 * `App.js` -> `vizStore.importCode(chart)` -> `fromSnapshot` -> `fillChart`
 * (`dist/models/visSpecHistory.js`), which merges the spec's OWN
 * `encodings` over `emptyEncodings` (whose `dimensions`/`measures` are both
 * `[]`) — never over `rawFields`. `VizSpecStore`'s `get dimensions()` /
 * `get measures()` getters then read `currentEncodings.dimensions` /
 * `.measures` directly, so the field panel renders whatever catalogue the
 * SPEC carried, not the `rawFields` prop.
 *
 * The shelf-only narrowing here (T-03-11, G-03-4) is still correct under
 * this accurate model, for a different reason than originally stated: a
 * catalogue entry can only ever appear as a draggable pill in the field
 * panel, never as a rendered mark on a shelf — and after this plan's change
 * (`src/lib/shareChartCatalogue.ts`), the panel's catalogue is unconditionally
 * rebuilt from the currently-loaded survey's own fields on decode anyway, so
 * a stale or foreign catalogue entry in a shared payload can never reach the
 * panel either. Excluding `dimensions`/`measures` here remains a deliberate
 * narrowing of the schema-drift check, not an oversight.
 */
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

/**
 * Every `fid` referenced by a chart-like value's shelf channels only —
 * `encodings.dimensions`/`encodings.measures` (the field catalogue) are
 * deliberately excluded, per `SHELF_CHANNEL_KEYS`'s doc comment above.
 */
function collectShelfFieldReferences(chart: Record<string, unknown>, out: Set<string>): void {
  const encodings = chart.encodings as Record<string, unknown>
  for (const key of SHELF_CHANNEL_KEYS) {
    if (key in encodings) {
      collectFieldReferences(encodings[key], out)
    }
  }
}

/**
 * Decodes a `?chart=` query-param value back into the value shape
 * GraphicWalker's `chart` prop expects — always the plural array shape
 * (`IChart[] | IVisSpec[]`), never a bare single chart-shaped object: a
 * `?chart=` payload whose JSON is a single chart-shaped object (not wrapped
 * in an array) is normalized into a one-element array before being
 * returned, so every caller's `IChart[] | undefined` contract holds (CR-01).
 * No other translation happens — this project carries GraphicWalker's own
 * plural chart-collection shape as-is, per the phase's assumption-delta
 * decision.
 *
 * This is a deliberate SOFT fallback, not the hard trust-boundary rejection
 * `parseEnquestaMeta` implements for server-fetched JSON (D-07): a stale or
 * malformed shared link is expected staleness as surveys evolve, not
 * attacker input crossing a data boundary, and the visitor should never see
 * an error for it. Every step below returns `undefined` on any failure —
 * this function must never throw, mirroring `formatDate`'s
 * detect-invalid-return-a-safe-default shape (src/lib/enquestes.ts).
 *
 * `knownFieldNames` is the currently-loaded survey's `meta.json` field list;
 * a decoded spec referencing a field absent from it (schema drift, a link
 * built against an older/different survey) is discarded rather than
 * applied.
 */
export function decodeShareLink(raw: string | null, knownFieldNames: string[]): unknown | undefined {
  // 1. Null, empty, or non-string input.
  if (raw === null || typeof raw !== 'string' || raw.length === 0) {
    return undefined
  }

  // 2. Length cap — first, before any decode work, so an oversized crafted
  // payload cannot consume memory or CPU (DoS guard, T-03-12).
  if (raw.length > MAX_SHARE_PARAM_LENGTH) {
    return undefined
  }

  // 3. Version tag.
  const separatorIndex = raw.indexOf(SEPARATOR)
  if (separatorIndex === -1) {
    return undefined
  }
  const tag = raw.slice(0, separatorIndex)
  const payload = raw.slice(separatorIndex + 1)
  if (tag !== SHARE_VERSION || payload.length === 0) {
    return undefined
  }

  // 4. base64url -> base64 -> binary string -> UTF-8 bytes -> JSON text.
  let json: string
  try {
    const base64 = fromBase64Url(payload)
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    json = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }

  // 5. JSON parse.
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return undefined
  }

  // 6. Reject anything that doesn't look like a chart spec (or an array of
  // them) before any field-reference logic runs — a bare JSON scalar (e.g.
  // the number 42) or an object missing the chart-spec shape must never
  // reach GraphicWalker's `chart` prop unchecked (CR-01). `ISpecProps.chart`
  // accepts `IChart[] | IVisSpec[]` in production (always an array, since
  // it's populated from `VizSpecStore.exportCode(): IChart[]`), so the array
  // form is validated element-by-element; a bare single chart-shaped object
  // is also accepted (and normalized into `charts`, the one-element array
  // returned at step 8 below — never the raw `parsed` value, see CR-01).
  // Running this guard first means the narrower field-reference check below
  // can rely on every chart it inspects having a confirmed `encodings`
  // object.
  const charts: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed]
  // A top-level empty array (e.g. `?chart=v1.W10`, base64 of `"[]"`) makes
  // `charts.every(isChartLike)` vacuously true — `Array.prototype.every`
  // returns `true` for an empty array — so it must be rejected explicitly
  // (WR-02) rather than relying on the `every` check alone. An empty array
  // is a different outcome from `undefined`: this function's contract is
  // that a malformed/stale link behaves like there was no link at all, and
  // `chart={[]}` would instead render zero chart tabs.
  if (charts.length === 0 || !charts.every(isChartLike)) {
    return undefined
  }

  // 7. Every field reference (fid) found on a SHELF CHANNEL — not the
  // dimensions/measures catalogue — must be present in the currently-loaded
  // meta.json's field list, OR be one of GraphicWalker's own virtual field
  // ids. This is the T-03-11 schema-drift control, narrowed in scope
  // (G-03-4): `encodings.dimensions`/`encodings.measures` enumerate every
  // field available in the dataset the sharer had, not the fields the
  // visualization actually uses, and GraphicWalker rebuilds that catalogue
  // from the `rawFields` prop at mount time — so a stale catalogue entry
  // cannot express a reference that survives into a rendered chart. Only
  // shelf channels can, so only shelf channels are inspected.
  const known = new Set(knownFieldNames)
  for (const chart of charts) {
    const referenced = new Set<string>()
    collectShelfFieldReferences(chart, referenced)
    for (const fid of referenced) {
      if (!known.has(fid) && !GRAPHIC_WALKER_VIRTUAL_FIDS.has(fid)) {
        return undefined
      }
    }
  }

  // 8. Return the normalized array, never the raw `parsed` value: a bare
  // single chart-shaped object was wrapped in `[parsed]` at step 6 only to
  // run it through the shape/field checks above — returning `parsed`
  // verbatim here would silently hand that unwrapped object back out,
  // violating the `IChart[] | undefined` contract every caller (and the
  // `as IChart[] | undefined` cast in ExplorerPage.tsx) relies on (CR-01).
  // `charts` is always an array — either `parsed` itself (already an
  // array) or `[parsed]` — so this also normalizes the bare-object input
  // shape into the one-element array form GraphicWalker's `chart` prop
  // expects.
  return charts
}
