---
phase: 01-foundation-survey-listing
plan: 03
subsystem: ui
tags: [react, react-router-dom, dialog]

requires:
  - phase: 01-foundation-survey-listing
    provides: "EnquestaMeta types, dataUrl trust-boundary pattern, SurveyCard/HomePage from plans 01-01 and 01-02"
provides:
  - "SurveySummaryModal — native-dialog KPI quick summary with sample-size disclosure and suppression (HOME-03)"
  - "URL-reflected (?enquesta=<id>) summary open/close so Back closes the modal (HOME-04)"
  - "Locked public/data/enquestes/<id>_meta.json contract — Phase 2's second conversion-script target"
  - "Honest ExplorerPage stating Phase-1 status instead of rendering empty"
affects: ["02-offline-data-pipeline", "03-interactive-explorer"]

actuals:
  tokens: 16000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Native <dialog> + showModal()/close() for real focus trap and Escape-to-dismiss, mapped to onClose via the dialog's own 'close' event"
    - "URL search param (?enquesta=) as the single source of truth for modal open state, so browser Back/Forward work for free"
    - "Guard-before-effect: an invalid id is rendered as a failure branch computed during render, never via a synchronous setState inside an effect"

key-files:
  created:
    - src/components/SurveySummaryModal.tsx
    - scripts/fixtures/enquestes/demo-2024_meta.json
  modified:
    - src/lib/enquestes.ts
    - src/pages/HomePage.tsx
    - src/components/SurveyCard.tsx
    - src/pages/ExplorerPage.tsx
    - scripts/fixtures/enquestes_index.json

key-decisions:
  - "Suppression threshold MIN_KPI_SAMPLE=10: a KPI's effective sample (its own n, or the survey-level n) below this renders 'Mostra insuficient per publicar aquest valor' instead of the value"
  - "Invalid enquesta id in the URL is dropped from the query string rather than left in place — never mount a modal doomed to fail"

patterns-established:
  - "Pattern: second trust-boundary parser (parseEnquestaMeta) mirrors parseEnquestesIndex's reject-early shape validation, same fixed Catalan failure copy discipline"

requirements-completed: [HOME-03, HOME-04]

coverage:
  - id: D1
    description: "Clicking a survey card opens a quick summary with headline KPIs, each carrying its effective sample size, loaded from that survey's own [id]_meta.json"
    requirement: "HOME-03"
    verification:
      - kind: unit
        ref: "source assertions: SurveySummaryModal references metaUrl, parseEnquestaMeta, MIN_KPI_SAMPLE, showModal, 'Mostra insuficient'"
        status: pass
      - kind: e2e
        ref: "preview-server probe: data/enquestes/demo-2024_meta.json served with expected shape under --fixtures; missing meta returns 404"
        status: pass
    human_judgment: true
    rationale: "Dialog focus behavior, the rendered KPI suppression copy in context, and dark-mode legibility are visual/stateful browser judgments — deferred to the plan's documented human-check for phase UAT."
  - id: D2
    description: "The open summary is reflected in the URL (?enquesta=<id>) so Back closes it instead of leaving the catalog, and the explorer hand-off never renders a blank page"
    requirement: "HOME-04"
    verification:
      - kind: unit
        ref: "source assertions: HomePage uses useSearchParams + isValidEnquestaId + SurveySummaryModal; ExplorerPage uses useParams + isValidEnquestaId, contains 'encara no està disponible' and 'Torna al llistat', no red-family class"
        status: pass
      - kind: e2e
        ref: "preview-server probe: deep link to /enquesta/demo-2024 returns the 404 fallback carrying pathSegmentsToKeep"
        status: pass
    human_judgment: true
    rationale: "Back/Escape dismissal and the address-bar round trip after the 404-redirect-restore sequence are only observable in a real browser — deferred to the plan's documented human-check for phase UAT."

duration: 14min
completed: 2026-08-26
status: complete
---

# Phase 1 Plan 3: Quick KPI Summary Summary

**Native-<dialog> SurveySummaryModal with sample-size-disclosed, suppression-aware KPI tiles, opened via a URL search param so Back closes it, handing off to an ExplorerPage that's honest about not being built yet.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-26T06:20:00Z
- **Completed:** 2026-08-26T06:34:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- `SurveySummaryModal` — native `<dialog>`-based quick summary reading `metaUrl(id)` through the new `parseEnquestaMeta` trust boundary, with its own loading/failure states and a suppression rule that withholds any KPI computed over fewer than 10 respondents while stating why
- `isValidEnquestaId`/`metaUrl` guard the visitor-controlled survey id (regex allowlist + percent-encoding) before it ever reaches a fetch path — a second instance of the same trust-boundary discipline `parseEnquestesIndex` established in plan 01-01
- `HomePage` now derives the open summary from the `?enquesta=` URL search param, so the browser Back button closes it instead of leaving the catalog; a hand-edited invalid id is dropped from the URL rather than mounting a doomed modal
- `ExplorerPage` rewritten to state its Phase-1 status plainly (or "No s'ha trobat aquesta enquesta." for an invalid id) with a working link back — no route in the app renders a blank page

## Task Commits

Each task was committed atomically:

1. **Task 1: Quick KPI summary modal reading [id]_meta.json (HOME-03)** - `2ea6f2f` (feat)
2. **Task 2: Wire card to summary to explorer via URL state (HOME-04)** - `c8e3d8a` (feat)

**Plan metadata:** committed alongside this SUMMARY

## Files Created/Modified
- `src/components/SurveySummaryModal.tsx` - KPI quick summary, native dialog, suppression rule
- `src/lib/enquestes.ts` - added `MIN_KPI_SAMPLE`, `isValidEnquestaId`, `metaUrl`, `parseEnquestaMeta`
- `src/pages/HomePage.tsx` - `useSearchParams`-driven modal open/close
- `src/components/SurveyCard.tsx` - `aria-haspopup="dialog"`
- `src/pages/ExplorerPage.tsx` - honest not-yet-available / not-found states, no red styling
- `scripts/fixtures/enquestes/demo-2024_meta.json`, `scripts/fixtures/enquestes_index.json` - `demo-2024` QA fixture pair exercising all three KPI sample cases

## Decisions Made
- **Suppression threshold:** `MIN_KPI_SAMPLE = 10` — a KPI's effective sample (its own `n`, falling back to the survey-level `n`) below this renders the withholding message instead of the value.
- Dropped an initial `setState({status:'loading'})` at the top of the modal's fetch effect (mirroring a fix already made in plan 01-02's `HomePage`) — `eslint-plugin-react-hooks`'s `set-state-in-effect` rule correctly flags synchronous `setState` in an effect body; `useState`'s own initial value already covers the loading case on mount.
- Invalid-id handling moved out of the effect entirely: `idValid` is computed during render and gates both the fetch effect (via early return, no setState) and the render branches — avoids a second `set-state-in-effect` violation for the guard case the plan specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Synchronous setState in effect (same class as plan 01-02's fix)**
- **Found during:** Task 1 (SurveySummaryModal)
- **Issue:** An initial draft reset state to `loading` synchronously at the top of the fetch effect on every `enquestaId` change; `react-hooks/set-state-in-effect` flags this.
- **Fix:** Removed the explicit reset — `useState`'s initial value already is `loading`, so no in-effect reset is needed on first render, and the modal is remounted per open (not reused across different survey ids) in this app's usage.
- **Files modified:** src/components/SurveySummaryModal.tsx
- **Verification:** `npm run lint` exits 0
- **Committed in:** 2ea6f2f (Task 1 commit)

**2. [Rule 1 - Bug] Plan's own invalid-id guard would have hit the same lint rule**
- **Found during:** Task 1 (SurveySummaryModal)
- **Issue:** The plan's literal instruction ("when isValidEnquestaId(enquestaId) is false, skip the request entirely and go straight to the failure state") implies a conditional synchronous `setState` inside the effect, which trips the same `set-state-in-effect` rule regardless of the conditional wrapping.
- **Fix:** Computed `idValid` once during render (not inside the effect) and used it both to gate the effect via an early `return` (no setState call at all) and to select the failure-state JSX branch directly during render — same observable behavior (invalid id never fetches, shows the failure copy), no lint violation.
- **Files modified:** src/components/SurveySummaryModal.tsx
- **Verification:** `npm run lint` exits 0; the negative source grep for `dangerously` and `/data/` paths still passes
- **Committed in:** 2ea6f2f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — the same `eslint-plugin-react-hooks` synchronous-setState pattern already seen in plan 01-02, applied consistently here)
**Impact on plan:** No scope creep — both fixes preserve the exact behavior the plan specified (loading on mount, immediate failure state for an invalid id) while satisfying the project's own lint gate.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None.

## Next Phase Readiness
**`EnquestaMeta` field list (final, locked for Phase 2's conversion script):**
`{ id: string; title: string; date: string; description: string; n: number; kpis: { label: string; value: number | string; unit?: string; n?: number }[]; fields?: { name: string; label?: string; description?: string; type: 'dimension' | 'measure' }[] }`

**On-disk `public/data/` layout locked across all three plans of this phase:**
- `enquestes_index.json` — the catalog array (plan 01-01)
- `enquestes/<id>_meta.json` — one per survey (this plan)
- `enquestes/<id>_respostes.parquet` — one per survey (Phase 2 produces, Phase 3 consumes)

Phase 1 is now feature-complete: all three plans (walking skeleton, survey catalog, quick KPI summary) are done. `public/data/` still contains only the empty-array index placeholder — Phase 2's DATA-03 privacy checklist gates when real data starts landing there. Ready for phase verification.

---
*Phase: 01-foundation-survey-listing*
*Completed: 2026-08-26*

## Self-Check: PASSED
