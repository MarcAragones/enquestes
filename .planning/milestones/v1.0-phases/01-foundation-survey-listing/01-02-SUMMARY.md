---
phase: 01-foundation-survey-listing
plan: 02
subsystem: ui
tags: [react, tailwindcss, lucide-react]

requires:
  - phase: 01-foundation-survey-listing
    provides: "EnquestaIndexEntry type, dataUrl/parseEnquestesIndex trust boundary, FetchState machine, HomePage/ThemeToggle scaffolding from plan 01-01"
provides:
  - "Text-only SurveyCard/SurveyGrid catalog UI (HOME-01)"
  - "LoadingSkeleton/ErrorState/EmptyState — four visibly distinct catalog states wired into HomePage (HOME-02)"
  - "formatDate/formatCount Catalan-locale formatters"
  - "scripts/fixtures/enquestes_index.json local-only QA fixture with edge cases (zero participants, markup in title, long description)"
affects: ["01-03-quick-kpi-summary", "02-offline-data-pipeline"]

actuals:
  tokens: 18000
  tasks: 3
  commits: 2

tech-stack:
  added: ["lucide-react@1.34.0"]
  patterns:
    - "Calm-vs-alarmed visual contrast: EmptyState uses a dashed neutral border, ErrorState uses a solid red-family border — never share styling so a broken deploy can't read as 'nothing published yet'"
    - "attempt counter drives HomePage's fetch effect dependency array, giving ErrorState's onRetry a real re-fetch instead of a stale state"

key-files:
  created:
    - src/components/SurveyCard.tsx
    - src/components/SurveyGrid.tsx
    - src/components/LoadingSkeleton.tsx
    - src/components/ErrorState.tsx
    - src/components/EmptyState.tsx
    - scripts/fixtures/enquestes_index.json
  modified:
    - src/lib/enquestes.ts
    - src/pages/HomePage.tsx
    - src/components/ThemeToggle.tsx
    - package.json

key-decisions:
  - "Task 1 checkpoint (blocking-human): lucide-react approved after verifying official lucide-icons org, ~97M weekly downloads, and a package history back to 2020 — installed at 1.34.0"
  - "onRetry sets state to loading before incrementing attempt (in the handler, not the effect body) — avoids an eslint-plugin-react-hooks set-state-in-effect violation while keeping the retry visibly reset"

patterns-established:
  - "Pattern: card as <button type=\"button\"> for single-target keyboard activation, aria-label combining title + participant count"

requirements-completed: [HOME-01, HOME-02]

coverage:
  - id: D1
    description: "Every published survey renders as a text-only card (title, date, description, exact participant count) in a responsive 1/2/3-column grid"
    requirement: "HOME-01"
    verification:
      - kind: unit
        ref: "source assertions: no <img>/<svg>/lucide/emoji in SurveyCard.tsx, sm:grid-cols-2 + lg:grid-cols-3 in SurveyGrid.tsx"
        status: pass
      - kind: integration
        ref: "fixture assertion: scripts/fixtures/enquestes_index.json holds 3 well-formed entries including one with n=0"
        status: pass
    human_judgment: true
    rationale: "Responsive column counts at different viewport widths and the literal (non-rendered) display of angle-bracket markup in a fixture title are visual judgments — deferred to the plan's documented human-check for phase UAT."
  - id: D2
    description: "Loading, load-failure-with-retry, and genuinely-empty-catalog are three states a visitor can never confuse with each other"
    requirement: "HOME-02"
    verification:
      - kind: unit
        ref: "source assertions: LoadingSkeleton has aria-busy+animate-pulse; EmptyState has border-dashed and no red-family class; ErrorState has a red-family class and onRetry"
        status: pass
      - kind: e2e
        ref: "preview-server probe: fixture index served as 3-entry array under --fixtures, missing data file returns 404"
        status: pass
    human_judgment: true
    rationale: "The calm-vs-alarmed visual contrast between EmptyState and ErrorState, and confirming both read correctly in dark mode, are visual judgments — deferred to the plan's documented human-check for phase UAT."

duration: 9min
completed: 2026-08-26
status: complete
---

# Phase 1 Plan 2: Survey Catalog Summary

**Text-only SurveyCard/SurveyGrid catalog UI with four visually distinct loading/error/empty/list states, backed by a local QA fixture exercising zero-participant and markup-injection edge cases.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-26T06:05:00Z
- **Completed:** 2026-08-26T06:14:00Z
- **Tasks:** 3 (1 checkpoint, 2 implementation)
- **Files modified:** 10

## Accomplishments
- `lucide-react` cleared through a blocking-human package-legitimacy checkpoint (official org, ~97M weekly downloads, 2020+ history) and installed at 1.34.0
- Text-only `SurveyCard`/`SurveyGrid` rendering the full catalog in a responsive 1/2/3-column grid, with `formatDate`/`formatCount` Catalan-locale formatting
- `LoadingSkeleton`, `ErrorState` (with working retry), and `EmptyState` wired into `HomePage`'s existing `FetchState` machine — replacing the plain list from the plan 01-01 tracer with the real designed states
- `scripts/fixtures/enquestes_index.json` — a local-only fixture (never deployed) exercising a zero-participant survey and a title containing literal angle-bracket markup, proving the React-escaping and `line-clamp-3` behavior

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate** - checkpoint only, no code commit (approved — recorded above)
2. **Task 2: Survey card and responsive grid (HOME-01)** - `8adfaf3` (feat)
3. **Task 3: Loading, failure and empty states (HOME-02)** - `aab10e8` (feat)

**Plan metadata:** committed alongside this SUMMARY

## Files Created/Modified
- `src/components/SurveyCard.tsx` - text-only card, keyboard-activatable button
- `src/components/SurveyGrid.tsx` - responsive grid (`sm:grid-cols-2 lg:grid-cols-3`)
- `src/components/LoadingSkeleton.tsx` - grid-shaped pulse placeholder, `aria-busy`
- `src/components/ErrorState.tsx` - alarmed red-family panel with retry
- `src/components/EmptyState.tsx` - calm dashed-border panel, visually distinct from ErrorState
- `src/lib/enquestes.ts` - added `formatDate`, `formatCount`
- `src/pages/HomePage.tsx` - rewired to the four real components, added `attempt`-driven retry
- `src/components/ThemeToggle.tsx` - swapped placeholder glyph for `lucide-react`'s `Sun`/`Moon`
- `scripts/fixtures/enquestes_index.json` - 3-entry QA fixture with edge cases

## Decisions Made
- **Task 1 checkpoint (blocking-human):** `lucide-react` approved after verifying it against the official `lucide-icons` GitHub org, ~97.2M weekly downloads, and a publish history since 2020 — no typo-squat risk found.
- `onRetry` resets to `loading` inside the retry handler itself (before incrementing `attempt`), not inside the fetch effect body — keeps the retry visibly reset without a synchronous `setState`-in-effect.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] eslint-plugin-react-hooks flagged a synchronous setState in the fetch effect**
- **Found during:** Task 3 (HomePage rewire)
- **Issue:** The initial rewire reset state to `loading` synchronously inside the effect body on every `attempt` change, which `react-hooks/set-state-in-effect` correctly flags.
- **Fix:** Moved the `setState({ status: 'loading' })` call into the `onRetry` handler (called before `setAttempt` increments) instead — the effect's own initial state is already `loading` via `useState`'s default, so no in-effect reset was needed.
- **Files modified:** src/pages/HomePage.tsx
- **Verification:** `npm run lint` exits 0
- **Committed in:** aab10e8 (Task 3 commit)

**2. [Rule 1 - Bug] Doc comment tripped the plan's own negative-assertion grep**
- **Found during:** Task 2 (SurveyCard)
- **Issue:** A first-draft doc comment on `SurveyCard.tsx` used the words "icon or emoji," which matched the plan's `grep -rniE '(<img|<svg|lucide|emoji)'` D-03 enforcement check on the literal word, not actual usage.
- **Fix:** Reworded the comment before running verify. No functional change.
- **Files modified:** src/components/SurveyCard.tsx
- **Verification:** the negative-assertion grep passes
- **Committed in:** 8adfaf3 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs caught by the plan's own verify gates, fixed before commit)
**Impact on plan:** No scope creep; both fixes were required to satisfy the plan's own acceptance criteria.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None.

## Next Phase Readiness
- `SurveyCard`'s `onSelect` currently navigates straight to `/enquesta/:id`; plan 01-03 changes that handler to open the quick-summary modal instead, whose own button then performs the navigation — no other change needed to `SurveyCard`/`SurveyGrid`.
- Ready for plan 01-03 (quick KPI summary modal).

---
*Phase: 01-foundation-survey-listing*
*Completed: 2026-08-26*

## Self-Check: PASSED
