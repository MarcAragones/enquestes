---
status: diagnosed
phase: 05-catalog-cutover-to-real-data
source: [05-VERIFICATION.md]
started: 2026-09-10T07:35:00Z
updated: 2026-09-24T00:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Homepage shows exactly three real survey cards
expected: Open a production preview build (`npm run preview:pages`, http://localhost:4173/enquestes/) and view the homepage. Exactly three survey cards render — the two Baròmetre d'Opinió Política waves and the Enquesta longitudinal — with no synthetic/demo card and no stray text referencing generated/sample data.
result: pass

### 2. Each survey's summary modal shows its own data
expected: Click each of the three cards' summary modal in turn. Each modal shows that survey's own title, date, description, participant count (2.000 / 6.706 / 2.000) and its own KPI tiles (6 / 1 / 4), never another survey's, and never a suppression placeholder.
result: pass
note: "Initially reported as failing for REO1145 — diagnosed as a stale local dist/ build artifact from an earlier verification agent's destructive rename test (renamed REO1145_meta.json to prove verify-pages.mjs has teeth, restored the source, but never rebuilt dist/). Not an application defect. Fixed with npm run build; re-tested and confirmed working."

### 3. Explorer loads each survey's own fields; no bleed when switching surveys
expected: From each summary, open the explorer, drag a field onto X and another onto Y to build a chart, then navigate back to the catalog and open a different survey's explorer. Each explorer's data dictionary and GraphicWalker field list show only that survey's own fields; dragging fields produces a real chart; no trace of the previously viewed survey's fields appears after switching.
result: pass
priority: high
note: "Originally tested against REO1167 and REO1151 only — REO1145 was unreachable at the time due to the stale-build issue in test 2 (now fixed, see G-05-2)."

### 4. Share-link restores on same survey, degrades silently on a different one
expected: On REO1151, build a chart using IDENTIFICADOR_COMPLET, click "Copia l'enllaç", open the copied URL in a new tab, then edit only the survey id in that URL to REO1167 and open it. The REO1151 tab restores the exact chart. The edited REO1167 URL loads normally with an empty default chart — no error banner, no blank canvas, no chart built from REO1151's fields.
result: issue
reported: "I get HTTP ERROR 431. in the past I got some errors while exporting the link because they are too long."
severity: blocker

### 5. Not-found message renders for a non-existent survey id
expected: Open http://localhost:4173/enquestes/enquesta/no-existeix-aquesta directly in a browser. The not-found message renders with no retry button — not a spinner, not a load-failure message.
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-05-2
  truth: "Each survey's summary modal shows its own title, date, description, participant count and its own KPI tiles, never another survey's, and never a suppression placeholder."
  status: resolved
  reason: "User reported: La tercera enquesta (REO1145) té un error i no es pot obrir."
  severity: blocker
  test: 2
  root_cause: "Stale local dist/ build artifact — an earlier verification agent's destructive rename test (renaming REO1145_meta.json to prove verify-pages.mjs's catalog-completeness gate has teeth) left dist/data/enquestes/REO1145_meta.json.bak on disk; the source file in public/ was correctly restored afterward but dist/ was never rebuilt before this UAT session started the preview server. Not an application code defect — SurveySummaryModal.tsx's 404 classifier was behaving correctly against a genuinely missing served file."
  artifacts: []
  missing: []
  resolved_by: "npm run build (rebuild dist/ from correct public/data/ source)"
  resolved_at: 2026-09-24
  no_code_fix_needed: true

- gap_id: G-05-4
  truth: "A ?chart= link copied from one survey restores that exact chart when reopened, and degrades gracefully (no error) on a different survey."
  status: failed
  reason: "User reported: I get HTTP ERROR 431. in the past I got some errors while exporting the link because they are too long."
  severity: blocker
  test: 4
  root_cause: "encodeShareLink (src/lib/shareLink.ts) has no output-length cap — MAX_SHARE_PARAM_LENGTH (4096) is enforced only in decodeShareLink as a decode-time DoS guard (T-03-12), never on what the encoder produces. GraphicWalker's real VizSpecStore.exportCode() always embeds the survey's ENTIRE field catalogue (every dimension/measure, not just shelved fields) into encodings.dimensions/encodings.measures, so payload size scales with the survey's field count rather than chart complexity. For REO1151 (291 fields) a realistic chart serializes to ~43KB JSON -> ~57,255-char base64url chart= value -> ~57KB URL, about 14x the app's own documented 'safe' length. Node's built-in http server (used by both `vite preview` and scripts/gh-pages-preview.mjs) enforces a default 16KB header-size limit at the raw HTTP parser level, before any app code runs, so it rejects the request with 431 — this would also fail on other real hosts/browsers with similar URL-length limits, not just this local server."
  artifacts:
    - path: "src/lib/shareLink.ts"
      issue: "encodeShareLink has no output-length cap; MAX_SHARE_PARAM_LENGTH only guards decode"
    - path: "src/pages/ExplorerPage.tsx"
      issue: "onCopyLink (lines 126-139) writes the encoded URL to the clipboard unconditionally, with no size check and no user-facing warning when the link will be unopenable"
  missing:
    - "Strip encodings.dimensions/encodings.measures down to only the fids actually referenced by the chart's shelves before encoding, since decodeShareLink's own validation only needs the shelf fids against knownFieldNames — not the full catalogue"
    - "Enforce a length cap on the encoder side (mirroring MAX_SHARE_PARAM_LENGTH) and fail the copy-link action with a visible message rather than silently producing a link that will 431 on open"
  debug_session: ""
