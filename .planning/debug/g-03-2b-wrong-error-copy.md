---
status: diagnosed
trigger: "G-03-2b (03-UAT.md): Visiting /enquesta/{invalid-id} shows ExplorerPage's own invalid-id copy (\"No s'ha trobat aquesta enquesta.\"), not the HomePage's survey-list load-failure copy — goal: find_root_cause_only"
created: 2026-08-27T19:38:05Z
updated: 2026-08-27T19:38:05Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-08-29
  status: diagnosed
---

## Current Focus

hypothesis: CONFIRMED — see Resolution
test: n/a (root cause confirmed, diagnose-only mode)
expecting: n/a
next_action: none — return ROOT CAUSE FOUND to caller

reasoning_checkpoint:
  hypothesis: "ExplorerPage's phase-2 (data-load) error branch renders `<ErrorState message={dataState.message} onRetry={onDataRetry} />` without a `title` prop, so it falls back to ErrorState's default title `\"No s'han pogut carregar les enquestes\"` — the exact HomePage plural wording the user reported — for ANY phase-2 failure, including a well-formed-but-nonexistent survey id (metaUrl 404), because ExplorerPage has no distinct 'record not found' branch separate from 'generic data fetch failed'."
  confirming_evidence:

    - "ErrorState.tsx:17 — default title literal is exactly `\"No s'han pogut carregar les enquestes\"`, character-for-character the string the user reported seeing."
    - "ExplorerPage.tsx:176 — `content = <ErrorState message={dataState.message} onRetry={onDataRetry} />` passes no `title` prop, unlike the engine-error branch at line 167-172 which explicitly passes `title=\"No s'ha pogut inicialitzar el motor de consultes.\"`."
    - "isValidEnquestaId (enquestes.ts:11-13) is a format-only regex `/^[A-Za-z0-9._-]{1,64}$/`; the reproduction id `no-existeix-aquesta` matches it (letters + hyphens only), so `valid` is `true` in ExplorerPage and the `!valid` \"not found\" branch (line 162) never fires for this id — it is a syntactically well-formed but non-existent survey id."
    - "03-01-PLAN.md line 260 specifies the phase-2 error branch's `message` only (\"No s'han pogut carregar les dades de l'enquesta.\") and never specifies a `title` for it — the implementation matches the plan exactly, so the gap originates in the plan/design, not an implementation slip."
    - "App.tsx:10 confirms the explorer route (`/enquesta/*`) always renders ExplorerPage's own tree (ruled out cross-page state bleed / routing misconfiguration as an alternative cause)."
    - "grep of all `<ErrorState` call sites shows only 2 of 4 pass an explicit `title` (ChartErrorBoundary and ExplorerPage's engine-error branch); HomePage and ExplorerPage's data-error branch both rely on the default, so both surfaces render character-identical title text."
  falsification_test: "If the phase-2 branch DID pass an explicit title (e.g. re-reading the file showed `title=\"...\"` at line 176), or if `valid` were false for `no-existeix-aquesta` (ruling out phase-2 from ever being reached), this hypothesis would be refuted. Neither is the case — confirmed by direct Read of both files."
  fix_rationale: "n/a — find_root_cause_only mode; a separate gap-closure plan implements the fix. Root cause is a missing/generic `title` on ExplorerPage's phase-2 ErrorState render, not a broken isValidEnquestaId guard (that guard works exactly as designed for format validation and was never intended to detect 'exists in the dataset')."
  blind_spots: "Did not execute the app in a browser/dev server to observe the network tab confirming metaUrl(id) actually 404s locally (relied on static code reading + regex evaluation + the UAT report's exact string match, which is very strong but not a live repro). Did not check whether GitHub Pages' 404.html SPA-redirect trick (public/404.html) could intercept a missing */data/*.json request differently in production than in local dev — irrelevant to root cause since the bug reproduces identically regardless of *why* the fetch fails (network blip, real 404, or dev-server 404), because the missing `title` prop is unconditional on all phase-2 failures."
  candidate_causes:

    - "code: ExplorerPage.tsx phase-2 error branch omits `title` prop on `<ErrorState>` (line 176)"
    - "config/design: 03-01-PLAN.md Task spec (line 260) never called for a distinct 'record not found' UX path for a well-formed-but-nonexistent id — the design conflated 'transient fetch failure' and 'this survey doesn't exist' into one generic error branch"
  and_gate: "no — a single root cause (missing title, falling back to a title string that happens to be borrowed from HomePage) fully explains the symptom on its own; the design gap (no distinct not-found path) is the same underlying decision, not an independent second condition that must co-occur."

## Symptoms

expected: |
  Visiting /enquesta/{invalid-id} shows ExplorerPage's own invalid-id copy
  ("No s'ha trobat aquesta enquesta."), not the HomePage's survey-list
  load-failure copy.
actual: |
  Visiting /enquesta/no-existeix-aquesta (a syntactically well-formed but
  non-existent survey id) shows the title "No s'han pogut carregar les
  enquestes" (HomePage's plural list-load-failure wording) instead of the
  expected "No s'ha trobat aquesta enquesta." not-found message.
errors: |
  None thrown to console/UI as an exception — the wrong error COPY is itself
  the symptom. Verbatim user report (Catalan): "Quan vaig a l'enllaç d'una
  enquesta que no existeix, l'error que surt és 'No s'han pogut carregar les
  enquestes'. Sembla que està intentant carregar una cosa que no existeix."
reproduction: |

  1. Visit /enquesta/no-existeix-aquesta (or any syntactically valid
     — [A-Za-z0-9._-]{1,64} — but non-existent survey id).

  2. Engine init (phase 1) succeeds normally.
  3. Phase-2 effect fetches metaUrl(id) -> 404 (no such
     public/data/enquestes/{id}_meta.json) -> Promise.all rejects.

  4. dataState is set to {status: 'error', message: "No s'han pogut
     carregar les dades de l'enquesta."}.

  5. Rendered via `<ErrorState message={dataState.message}
     onRetry={onDataRetry} />` with no `title` prop -> ErrorState defaults
     title to "No s'han pogut carregar les enquestes" (HomePage's wording).
started: |
  Discovered during Phase 3 UAT (03-UAT.md, Test 2, gap G-03-2b). Present
  since ExplorerPage's phase-2 error branch was implemented per
  03-01-PLAN.md Task (line 258-260) — not a regression, a design/plan gap
  carried through implementation as specified.

## Eliminated

- hypothesis: "isValidEnquestaId's format-validation guard is broken/bypassed and fails to catch this id."
  evidence: "isValidEnquestaId(id) = /^[A-Za-z0-9._-]{1,64}$/.test(id). 'no-existeix-aquesta' contains only letters and hyphens, so it correctly matches the regex and `valid` is `true`. The guard is working exactly as designed — it validates URL-segment SHAPE only, not dataset existence. It was never intended to (and cannot, without a fetch) know whether a given id has a corresponding survey."
  timestamp: 2026-08-27T19:38:05Z

- hypothesis: "A stale HomePage error state or a shared error-message constant/module-level variable is bleeding through into the ExplorerPage render."
  evidence: "App.tsx:10 (`isExplorerRoute = pathname.startsWith('/enquesta/')`) confirms the /enquesta/:id route always mounts ExplorerPage's own component tree via router.tsx; HomePage and ExplorerPage hold fully independent useState — no shared/module-level error string exists between them. The only shared artifact is ErrorState's *default prop value* (a compile-time literal, not runtime state), which both pages independently fall back to when they don't pass an explicit `title`."
  timestamp: 2026-08-27T19:38:05Z

## Evidence

- timestamp: 2026-08-27T19:38:05Z
  checked: src/components/ErrorState.tsx (full read)
  found: "`title` prop defaults to the literal `\"No s'han pogut carregar les enquestes\"` (line 17), rendered in bold as the alert's primary heading (line 27); `message` renders below it in smaller text (line 28)."
  implication: "Any caller that omits `title` will show this exact HomePage-flavored heading, regardless of what `message` says underneath — the visually dominant text a user reads first/only is the title, not the message."

- timestamp: 2026-08-27T19:38:05Z
  checked: src/pages/ExplorerPage.tsx (full read)
  found: "Phase-1 (engine) error branch (lines 165-172) explicitly passes `title=\"No s'ha pogut inicialitzar el motor de consultes.\"`. Phase-2 (data) error branch (line 176) passes only `message={dataState.message}` and `onRetry` — no `title`. The `!valid` branch (line 161-162) is a separate plain `<p>`, not routed through ErrorState at all, and only fires when `isValidEnquestaId(id)` returns false."
  implication: "The phase-2 branch is the one hit for a well-formed-but-nonexistent id (since `valid` is true, so it skips the not-found `<p>` and proceeds through both fetch phases), and it is the one missing an explicit title — directly producing the reported symptom."

- timestamp: 2026-08-27T19:38:05Z
  checked: src/lib/enquestes.ts, isValidEnquestaId (lines 11-13)
  found: "Regex is `/^[A-Za-z0-9._-]{1,64}$/` — format/shape validation only, no existence check. `no-existeix-aquesta` matches (letters + hyphens, 20 chars)."
  implication: "Confirms `valid` is `true` for the reproduction id in ExplorerPage, so execution reaches phase 1 and phase 2 rather than short-circuiting to the not-found `<p>`."

- timestamp: 2026-08-27T19:38:05Z
  checked: .planning/phases/03-interactive-explorer/03-01-PLAN.md (grep + line 258-260 context)
  found: "Task spec for ExplorerPage's phase-2 error rendering: 'On rejection render `<ErrorState>` with message `No s'han pogut carregar les dades de l'enquesta.` and an `onRetry`...' — no title is specified for this branch, only for phase-1 (line 259: 'render `<ErrorState>` with title `No s'ha pogut inicialitzar el motor de consultes.`...')."
  implication: "The implementation matches the plan exactly — this is not an implementation slip introduced independently of the plan; the plan itself never called for a distinct title (or a distinct not-found UX) for the 'record doesn't exist' sub-case of phase-2 failure, so ExplorerPage's data-error branch was designed to only ever produce a generic (defaulted) heading."

- timestamp: 2026-08-27T19:38:05Z
  checked: src/App.tsx (full read) — routing/layout guard for '/enquesta/' prefix
  found: "`isExplorerRoute = pathname.startsWith('/enquesta/')` correctly gates App's shared chrome; confirms /enquesta/:id always renders ExplorerPage, not HomePage, ruling out a routing misconfiguration as an alternative explanation."
  implication: "Rules out the 'wrong page rendered' alternative hypothesis — the correct page (ExplorerPage) is rendering, it's just rendering the wrong ErrorState title."

- timestamp: 2026-08-27T19:38:05Z
  checked: "grep -rn '<ErrorState' src/ — all 4 call sites"
  found: "ChartErrorBoundary.tsx:39 and ExplorerPage.tsx:167 (engine error) pass explicit `title`; HomePage.tsx:78 and ExplorerPage.tsx:176 (data error) do not, and both therefore render the identical default title string."
  implication: "Directly explains why the user's report exactly quotes the string that also happens to be HomePage's wording — it's the same JS literal, reached via two different call sites that both omit `title`."

## Resolution

root_cause: |
  ExplorerPage's phase-2 (data-load) `<ErrorState>` render (ExplorerPage.tsx
  line 176) omits an explicit `title` prop, so it falls back to
  ErrorState.tsx's default title literal — "No s'han pogut carregar les
  enquestes" — which is character-identical to HomePage's list-load-failure
  heading (HomePage.tsx line 78, also relying on the same default). This
  branch fires for a well-formed-but-nonexistent survey id (e.g.
  no-existeix-aquesta) because isValidEnquestaId only validates URL-segment
  SHAPE, not dataset existence: such an id passes `isValidEnquestaId` (so
  `valid` is true and ExplorerPage's dedicated "No s'ha trobat aquesta
  enquesta." not-found branch, gated on `!valid`, never fires), then
  proceeds through phase 1 (engine init, succeeds) and phase 2 (fetches
  metaUrl(id), which genuinely 404s for a nonexistent id) — landing in the
  generic phase-2 catch, which is title-less and therefore borrows
  HomePage's wording. This matches 03-01-PLAN.md's task spec verbatim (line
  260 specifies only a `message` for this branch, never a `title`) — the
  design never distinguished "this specific survey record doesn't exist"
  from "a transient fetch/network failure" as two different UX outcomes;
  both collapse into one generically-titled error branch.
fix: ""
verification: ""
files_changed: []
