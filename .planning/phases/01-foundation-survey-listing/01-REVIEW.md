---
phase: 01-foundation-survey-listing
reviewed: 2026-08-26T00:00:00Z
depth: standard
files_reviewed: 34
files_reviewed_list:
  - .github/workflows/deploy.yml
  - .gitignore
  - .nvmrc
  - README.md
  - eslint.config.js
  - index.html
  - package.json
  - public/404.html
  - public/data/enquestes_index.json
  - public/favicon.svg
  - scripts/fixtures/enquestes/demo-2024_meta.json
  - scripts/fixtures/enquestes_index.json
  - scripts/gh-pages-preview.mjs
  - scripts/verify-pages.mjs
  - src/App.tsx
  - src/components/EmptyState.tsx
  - src/components/ErrorState.tsx
  - src/components/LoadingSkeleton.tsx
  - src/components/SurveyCard.tsx
  - src/components/SurveyGrid.tsx
  - src/components/SurveySummaryModal.tsx
  - src/components/ThemeToggle.tsx
  - src/hooks/useTheme.ts
  - src/index.css
  - src/lib/enquestes.ts
  - src/main.tsx
  - src/pages/ExplorerPage.tsx
  - src/pages/HomePage.tsx
  - src/router.tsx
  - src/types/enquesta.ts
  - tsconfig.app.json
  - tsconfig.json
  - tsconfig.node.json
  - vite.config.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

## Summary

Reviewed the full Phase 1 file set: the walking-skeleton routing/theme scaffold, the survey catalog (`HomePage`/`SurveyGrid`/`SurveyCard`), the KPI summary modal, the two fetch-trust-boundary parsers in `src/lib/enquestes.ts`, the id-validation path (`isValidEnquestaId`/`metaUrl`), the GitHub Pages deploy workflow, and the local preview/verify tooling.

The security-sensitive surfaces called out in scope hold up: `isValidEnquestaId` uses a bounded, ReDoS-safe character-class regex that rejects `/`, so no attacker-controlled id can produce a path-traversal segment even before `metaUrl`'s `encodeURIComponent` defense-in-depth is applied; there is no `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere in `src/`, so survey-provided text (including the deliberately hostile `<script>` string carried in the fixture data) is rendered as inert text via JSX's default escaping, confirmed against the actual fixture; the GitHub Actions workflow scopes `permissions` to the minimum needed (`contents: read`, `pages: write`, `id-token: write`) and doesn't fetch untrusted third-party actions beyond the standard GitHub-owned deploy chain; and `tsc -b`/`eslint` both run clean against the current tree.

No blocker-level defects were found. The issues below are real but non-critical: a genuine date-rendering bug (verified by reproduction) that shows the wrong calendar day to visitors in negative-UTC-offset timezones, a pluralization inconsistency between the card and the modal, a validation gap in one of the two trust-boundary parsers, and several maintainability/hygiene items (stale README, silently-swallowed fetch errors, un-pinned Action tags, unvalidated negative counts).

## Warnings

### WR-01: `formatDate` shows the wrong calendar day for viewers west of UTC

**File:** `src/lib/enquestes.ts:68-76`
**Issue:** `new Date(iso)` on a date-only ISO string (e.g. `"2024-11-05"`) is parsed as UTC midnight per the ECMA-262 spec, but `Intl.DateTimeFormat` without an explicit `timeZone` formats in the *host's local* timezone. For any visitor in a negative-UTC-offset timezone the displayed date rolls back one day. Reproduced directly:
```
$ TZ=America/Los_Angeles node -e "
console.log(new Intl.DateTimeFormat('ca-ES', {day:'numeric',month:'long',year:'numeric'}).format(new Date('2024-11-05')))"
4 de novembre del 2024   # should be "5 de novembre del 2024"
```
This is a public, globally-reachable GitHub Pages site (not scoped to a single timezone), so this will misreport survey/publication dates for a real slice of visitors (e.g. all of North/South America). Affects every call site: `SurveyCard.tsx:26` and `SurveySummaryModal.tsx:111`.
**Fix:** Force UTC interpretation on the formatter (the ISO date has no time-of-day component to lose):
```ts
return new Intl.DateTimeFormat('ca-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(d)
```

### WR-02: `SurveySummaryModal` hardcodes plural "participants", inconsistent with `SurveyCard`

**File:** `src/components/SurveySummaryModal.tsx:116`
**Issue:** `SurveyCard.tsx:15` correctly computes `enquesta.n === 1 ? 'participant' : 'participants'`, but the modal's participant-count line hardcodes the plural unconditionally: `{formatCount(state.data.n)} participants`. A survey with `n === 1` reads "1 participants" in the modal while the card for the same survey correctly reads "1 participant" — an observable inconsistency for the exact same data.
**Fix:**
```tsx
const participantsLabel = state.data.n === 1 ? 'participant' : 'participants'
...
<p className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
  {formatCount(state.data.n)} {participantsLabel}
</p>
```

### WR-03: `parseEnquestaMeta`'s optional `fields[]` validation skips `label`/`description`

**File:** `src/lib/enquestes.ts:127-134`
**Issue:** This function is one of the two explicitly-called-out trust boundaries for fetched JSON. Every other field on `EnquestaMeta`/`EnquestaMetaKpi` is type-checked (including the optional `unit`/`n` on kpis), but the loop over `fields` only validates `name` and `type`, silently letting through any value (or wrong type) for the optional `label`/`description` properties declared on `EnquestaMetaField`:
```ts
const { name, type } = field as Record<string, unknown>
if (typeof name !== 'string') throw new Error('Format inesperat')
if (type !== 'dimension' && type !== 'measure') throw new Error('Format inesperat')
```
`fields` isn't rendered yet in Phase 1, so there's no current runtime impact, but a malformed `label`/`description` (e.g. an object or number) would flow past this parser untyped and surface as a type mismatch the moment a later phase renders it.
**Fix:**
```ts
const { name, type, label, description } = field as Record<string, unknown>
if (typeof name !== 'string') throw new Error('Format inesperat')
if (type !== 'dimension' && type !== 'measure') throw new Error('Format inesperat')
if (label !== undefined && typeof label !== 'string') throw new Error('Format inesperat')
if (description !== undefined && typeof description !== 'string') throw new Error('Format inesperat')
```

## Info

### IN-01: README.md is unmodified Vite scaffold boilerplate

**File:** `README.md:1-32`
**Issue:** The README still describes the generic `npm create vite` template (Oxlint config example, generic plugin list) and says nothing about what this project is, how to run it, or the custom scripts added in this phase (`preview:pages`, `verify:pages`, the `public/data/` layout). Anyone landing on the repo gets no orientation.
**Fix:** Replace with a short project-specific README: what the app is (link to `CLAUDE.md`/`PROJECT.md`), `npm run dev`/`build`/`lint`, and what `preview:pages`/`verify:pages` do and when to use them.

### IN-02: Fetch/parse failures are fully swallowed with no diagnostic trail

**File:** `src/pages/HomePage.tsx:28-35`, `src/components/SurveySummaryModal.tsx:58-65`
**Issue:** Both `.catch()` handlers discard the actual `Error` entirely and only set a generic user-facing message. That's the right call for the UI (no raw error text should leak to visitors), but with no backend and no error-tracking service in this $0 project, there's also no `console.error` — so a real regression (bad JSON, wrong `base` path, 404 on `enquestes_index.json`) is indistinguishable from any other failure in the browser console while debugging a live deploy.
**Fix:** Log the underlying error before setting user-facing state, e.g. `.catch((err) => { console.error(err); if (!cancelled) setState({...}) })`.

### IN-03: GitHub Actions steps pinned to major-version tags, not commit SHAs

**File:** `.github/workflows/deploy.yml:25,28,40,43,49`
**Issue:** `actions/checkout@v7`, `actions/setup-node@v7`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` are all pinned to mutable major-version tags. This is standard/common practice and low risk for these first-party GitHub actions specifically, but it's still a supply-chain hardening gap (a compromised or force-pushed tag would run in this workflow's context, which has `pages: write`/`id-token: write`).
**Fix:** Pin to a full commit SHA with the version as a trailing comment, e.g. `actions/checkout@<sha> # v7.0.0`, and use Dependabot/Renovate to keep the SHAs current.

### IN-04: `n` / kpi `n` are validated as finite numbers but not as non-negative

**File:** `src/lib/enquestes.ts:48-57` (`parseEnquestesIndex`), `:94-103` and `:112-121` (`parseEnquestaMeta`)
**Issue:** Both parsers check `typeof n === 'number' && Number.isFinite(n)` but never `n >= 0`. A malformed or mistyped source JSON with a negative participant count would pass validation and render as e.g. `formatCount(-5)` → `"-5 participants"` in `SurveyCard`/`SurveySummaryModal`. Low risk since the data is first-party (not adversarial), but it's a cheap and consistent addition to an otherwise careful trust-boundary check.
**Fix:** Add `|| n < 0` to each of the three finite-number guards (`n` in both parsers, and `kpiN` in `parseEnquestaMeta`).

---

_Reviewed: 2026-08-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
