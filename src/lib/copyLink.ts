import { SHARE_PARAM, encodeShareLinkResult } from './shareLink'

/**
 * Outcome of a "Copia l'enllaç" attempt. The Catalan message strings live
 * here, beside the outcome they belong to, specifically so they are covered
 * by an automated test (`copyLink.test.ts`) — this project has no i18n
 * layer, and `environment: 'node'` (vitest config) means component
 * rendering is not unit-testable, so a string embedded directly in a
 * component would have no automated coverage of its wording.
 */
export type CopyLinkOutcome = { ok: true; url: string } | { ok: false; message: string }

export const SHARE_TOO_LONG_MESSAGE =
  "Aquest gràfic és massa gran per compartir-lo com a enllaç. Prova de simplificar-lo: menys camps o menys valors de filtre."

export const SHARE_ENCODE_FAILED_MESSAGE = "No s'ha pogut generar l'enllaç d'aquest gràfic."

export const CLIPBOARD_FAILED_MESSAGE = "No s'ha pogut copiar l'enllaç al porta-retalls."

/**
 * Builds the shareable URL for `spec` against the current page's `href`,
 * or a `CopyLinkOutcome` failure explaining why not. Pure — no clipboard
 * access here (`ExplorerPage.tsx`'s `onCopyLink` owns the clipboard write,
 * separately, so this function stays unit-testable in `environment: 'node'`
 * without a DOM).
 *
 * Never throws: a malformed `href` is caught and mapped to the same
 * encode-failed outcome as an unserializable spec, rather than propagating
 * the `URL` constructor's `TypeError`.
 */
export function buildShareUrl(href: string, spec: unknown): CopyLinkOutcome {
  const result = encodeShareLinkResult(spec)
  if (!result.ok) {
    return {
      ok: false,
      message: result.reason === 'too-long' ? SHARE_TOO_LONG_MESSAGE : SHARE_ENCODE_FAILED_MESSAGE,
    }
  }

  let url: URL
  try {
    url = new URL(href)
  } catch {
    return { ok: false, message: SHARE_ENCODE_FAILED_MESSAGE }
  }

  url.searchParams.set(SHARE_PARAM, result.param)
  return { ok: true, url: url.toString() }
}
