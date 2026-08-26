---
phase: 01-foundation-survey-listing
plan: 01
subsystem: infra
tags: [react, vite, typescript, tailwindcss, react-router-dom, github-actions, github-pages]

requires: []
provides:
  - "Node 22 + Vite 8 + React 19 + TypeScript 6 + Tailwind v4 scaffold under /enquestes/ base"
  - "BrowserRouter deep-link routing with the rafgraph/spa-github-pages 404.html redirect pair"
  - "dataUrl()/parseEnquestesIndex() data-fetch contract other phases build against"
  - "useTheme() dark/light persistence"
  - "Live GitHub Actions -> GitHub Pages deploy pipeline on push to main"
affects: ["02-offline-data-pipeline", "03-interactive-explorer"]

actuals:
  tokens: 24000
  tasks: 4
  commits: 3

tech-stack:
  added: [react@19.2.8, vite@8.2.2, typescript@6.0.3, tailwindcss@4.3.3, "@tailwindcss/vite@4.3.3", react-router-dom@7.18.2, eslint@10.9.1, typescript-eslint@8.68.0]
  patterns:
    - "dataUrl() is the only function permitted to compose a /data/ URL — never hardcode a root-relative path"
    - "React.lazy + Suspense for the explorer route to keep future DuckDB-Wasm/GraphicWalker code out of the homepage bundle"
    - "FetchState<T> discriminated union for loading/error/success data flows"

key-files:
  created:
    - src/types/enquesta.ts
    - src/lib/enquestes.ts
    - src/hooks/useTheme.ts
    - src/pages/HomePage.tsx
    - src/pages/ExplorerPage.tsx
    - src/router.tsx
    - public/404.html
    - scripts/gh-pages-preview.mjs
    - .github/workflows/deploy.yml
  modified:
    - vite.config.ts
    - src/index.css
    - src/main.tsx
    - src/App.tsx
    - index.html

key-decisions:
  - "Routing strategy: BrowserRouter + 404.html redirect pair (Task 2 checkpoint, user-confirmed) over HashRouter — clean shareable URLs for EXPL-11's future query-param chart links"
  - "eslint-plugin-react-hooks@7's bundled flat configs ship a legacy plugins:[string] array incompatible with ESLint 10 flat config — registered the plugin explicitly and spread its rules instead of using configs.recommended-latest via extends"
  - "create-vite now scaffolds oxlint by default; swapped to ESLint + typescript-eslint flat config per CLAUDE.md's stack mandate"

patterns-established:
  - "Pattern: base-path-aware data URLs via import.meta.env.BASE_URL, enforced by a source grep banning hardcoded /data/ paths"
  - "Pattern: tracer feedback gate — production-quality one-path slice verified end-to-end (lint+build+live preview probes) before the deploy task expanded it further"

requirements-completed: [DEPLOY-01, DEPLOY-02]

coverage:
  - id: D1
    description: "Live GitHub Pages URL serves the React app under /enquestes/ and redeploys automatically on push to main"
    requirement: "DEPLOY-01"
    verification:
      - kind: e2e
        ref: "live fetch probe: https://marcaragones.github.io/enquestes/ returns 200 with id=\"root\""
        status: pass
      - kind: other
        ref: "gh run list --workflow deploy.yml --limit 1 --json conclusion -> success"
        status: pass
    human_judgment: false
  - id: D2
    description: "Deep links resolve through the 404.html fallback to the correct route instead of 404-ing, and the address bar settles on the clean URL"
    requirement: "DEPLOY-02"
    verification:
      - kind: e2e
        ref: "live fetch probe: https://marcaragones.github.io/enquestes/enquesta/demo-2024 returns the 404.html body containing pathSegmentsToKeep"
        status: pass
    human_judgment: true
    rationale: "The redirect-then-replaceState round trip and the resulting address-bar URL are only observable in a real browser; a plain fetch sees the fallback document but never runs its restore script."
  - id: D3
    description: "Homepage renders four distinct states (loading/error/empty/list) from enquestes_index.json and the theme toggle persists across reloads"
    verification:
      - kind: automated_ui
        ref: "npm run verify:pages — local gh-pages-preview probes"
        status: pass
    human_judgment: true
    rationale: "User confirmed via the Task 3 tracer feedback checkpoint (empty-catalog message, theme toggle contrast, and the explorer not-yet-available page all visually verified in a browser)."

duration: 22min
completed: 2026-08-26
status: complete
---

# Phase 1 Plan 1: Walking Skeleton Summary

**Vite 8 + React 19 + TypeScript 6 + Tailwind v4 app deployed live to GitHub Pages via GitHub Actions, with BrowserRouter deep-link routing, a validated data-fetch contract, and dark-mode persistence.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-08-26T05:26:00Z
- **Completed:** 2026-08-26T05:48:00Z
- **Tasks:** 4
- **Files modified:** 33

## Accomplishments
- Node 22 + Vite 8 + React 19 + TypeScript 6 + Tailwind v4 project scaffolded and building clean under the `/enquestes/` base path
- End-to-end tracer: BrowserRouter with lazy-loaded explorer route, `dataUrl()`/`parseEnquestesIndex()` trust-boundary data contract, four-state homepage, dark/light theme with `localStorage` persistence and system-preference fallback
- `rafgraph/spa-github-pages` 404.html/index.html redirect pair proven locally via a zero-dependency preview server (`scripts/gh-pages-preview.mjs`) that reproduces GitHub Pages 404 semantics
- Least-privilege GitHub Actions workflow deploying to GitHub Pages on every push to `main`; live site verified at https://marcaragones.github.io/enquestes/

## Task Commits

Each task was committed atomically:

1. **Task 1: Node 22 toolchain, Vite/React/TS scaffold, Tailwind v4 and design tokens** - `972f24f` (feat)
2. **Task 2: Routing-strategy gate** - checkpoint, no code commit (decision recorded below)
3. **Task 3: End-to-end tracer** - `5a71180` (feat)
4. **Task 4: GitHub Actions deploy to GitHub Pages** - `64ad8f8` (feat)

**Plan metadata:** committed alongside this SUMMARY

## Files Created/Modified
- `src/types/enquesta.ts` - `EnquestaIndexEntry`/`EnquestaMeta`/`FetchState<T>` cross-phase contracts
- `src/lib/enquestes.ts` - `dataUrl()` and `parseEnquestesIndex()` — the sole data-URL composer and fetch trust boundary
- `src/hooks/useTheme.ts` - dark/light state with validated `localStorage` read and `prefers-color-scheme` fallback
- `src/pages/HomePage.tsx` - four-state catalog fetch/render
- `src/pages/ExplorerPage.tsx` - honest not-yet-available explorer route
- `src/router.tsx` - route table with lazy-loaded explorer route
- `public/404.html`, `index.html` - GitHub Pages SPA deep-link redirect/restore pair
- `public/data/enquestes_index.json` - empty catalog placeholder (`[]`)
- `scripts/gh-pages-preview.mjs`, `scripts/verify-pages.mjs` - local reproduction of GitHub Pages 404 semantics
- `.github/workflows/deploy.yml` - least-privilege build-and-deploy pipeline
- `vite.config.ts`, `src/index.css` - `/enquestes/` base path, Tailwind v4 tokens (D-01/D-04)

## Decisions Made
- **Routing (Task 2 checkpoint):** BrowserRouter + 404.html redirect pair, confirmed by the user over HashRouter — preserves clean shareable URLs for Phase 3's planned query-param chart-state links (EXPL-11).
- Bumped TypeScript patch from the researched `~6.0.2` pin to `~6.0.3` (current published patch on the same 6.x line, still within `typescript-eslint`'s `<6.1.0` peer range).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] create-vite now scaffolds oxlint, not ESLint**
- **Found during:** Task 1 (scaffold)
- **Issue:** The current `create-vite` react-ts template ships `oxlint` by default instead of ESLint + typescript-eslint; CLAUDE.md's stack mandate and this plan's `files_modified` both specify `eslint.config.js`.
- **Fix:** Removed `oxlint`, installed `eslint`, `typescript-eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`, wrote a flat `eslint.config.js`, and pointed `npm run lint` at `eslint .`.
- **Files modified:** package.json, package-lock.json, eslint.config.js
- **Verification:** `npm run lint` exits 0
- **Committed in:** 972f24f (Task 1 commit)

**2. [Rule 1 - Bug] eslint-plugin-react-hooks@7's bundled flat configs are not actually flat**
- **Found during:** Task 3 (lint verification)
- **Issue:** `reactHooks.configs['recommended-latest']` (and its `flat` alias) still carry a legacy eslintrc `plugins: ["react-hooks"]` array, which ESLint 10's flat config rejects outright (`eslint.config.js` extends chain threw immediately).
- **Fix:** Registered `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` explicitly as flat-config plugin objects and spread their `.rules` directly instead of using the plugins' own bundled configs via `extends`.
- **Files modified:** eslint.config.js
- **Verification:** `npm run lint` exits 0 with zero errors
- **Committed in:** 5a71180 (Task 3 commit — fix was applied before Task 3's code, folded into that commit since Task 1 was already committed)

**3. [Rule 3 - Blocker] `gh` CLI and GitHub auth were both missing on this machine**
- **Found during:** Task 4 precondition check
- **Issue:** No `gh` CLI installed, no GitHub session authenticated, no `origin` remote, branch was `master` not `main` — all flagged in advance by the plan's `user_setup` block.
- **Fix:** Installed `gh` via Homebrew, raised a `checkpoint:human-action` for the browser-based `gh auth login` step (repo + workflow scopes), then automated everything else: `git branch -M main`, `gh repo create enquestes --public --source=. --remote=origin`, push, and `gh api ... /pages -f build_type=workflow`.
- **Files modified:** none (repo/auth state only)
- **Verification:** `gh auth status` shows an authenticated account; live deploy run concluded `success`
- **Committed in:** n/a (infrastructure step, not a code change)

---

**Total deviations:** 3 auto-fixed (1 blocker — linter tooling, 1 bug — plugin flat-config incompatibility, 1 blocker — GitHub CLI/auth/remote setup)
**Impact on plan:** All three were necessary to satisfy the plan's own acceptance criteria (a working `npm run lint` and a live deploy); no scope creep beyond what Task 1/3/4 already required.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None further — `gh auth login` (the one manual step) was completed during Task 4 via the authentication-gate checkpoint.

## Next Phase Readiness
- The `EnquestaIndexEntry`/`EnquestaMeta` type contracts and `dataUrl()` helper are locked and ready for Phase 2's Python conversion script to emit against.
- `public/data/enquestes_index.json` currently ships the empty-array placeholder only — Phase 2's DATA-03 privacy checklist gates when real survey data starts landing there.
- Live site: https://marcaragones.github.io/enquestes/
- Ready for plan 01-02 (survey catalog card grid).

---
*Phase: 01-foundation-survey-listing*
*Completed: 2026-08-26*

## Self-Check: PASSED
