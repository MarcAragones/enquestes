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
 * Encodes a GraphicWalker chart spec (or spec collection) into a versioned,
 * UTF-8-safe, URL-safe string suitable for a query-param value. Returns
 * `null` — never throws — when the value cannot be JSON-serialised; the
 * caller (the "Copia l'enllaç" click handler) treats `null` as "do not
 * write anything to the clipboard", per D-07's silent-fallback posture.
 *
 * A direct `btoa(JSON.stringify(spec))` throws on any character outside
 * Latin-1, and this survey's dimension/filter values carry accented
 * Catalan text — so the payload is routed through TextEncoder first to get
 * UTF-8 bytes, then converted to a binary string btoa can safely consume.
 */
export function encodeShareLink(spec: unknown): string | null {
  let json: string
  try {
    json = JSON.stringify(spec)
  } catch {
    return null
  }
  if (json === undefined) {
    // JSON.stringify returns the *value* undefined (not a string) for
    // inputs like `undefined` or a bare function — treat as unencodable.
    return null
  }

  try {
    const bytes = new TextEncoder().encode(json)
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    const base64 = btoa(binary)
    return `${SHARE_VERSION}${SEPARATOR}${toBase64Url(base64)}`
  } catch {
    return null
  }
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
 * Decodes a `?chart=` query-param value back into the value shape
 * GraphicWalker's `chart` prop expects — no wrapping, no normalisation, no
 * singular/plural translation (this project carries GraphicWalker's own
 * plural chart-collection shape as-is, per the phase's assumption-delta
 * decision).
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

  // 6. Every field reference (fid) must be present in the currently-loaded
  // meta.json's field list — schema-drift control (T-03-11).
  const referenced = new Set<string>()
  collectFieldReferences(parsed, referenced)
  const known = new Set(knownFieldNames)
  for (const fid of referenced) {
    if (!known.has(fid)) {
      return undefined
    }
  }

  // 7. Return the parsed value verbatim — shaped exactly as the `chart`
  // prop expects.
  return parsed
}
