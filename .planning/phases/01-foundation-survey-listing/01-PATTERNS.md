# Phase 1: Foundation & Survey Listing - Pattern Map

**Mapped:** 2026-08-25
**Files analyzed:** 20 (new)
**Analogs found:** 0 / 20 — greenfield phase, no existing source code

## Greenfield Notice

This is the **first phase of a brand-new repository**. Verified via directory listing: only `.claude/` and `.planning/` exist on disk — no `src/`, `public/`, `package.json`, or any application code. There is **no codebase to mine for analogs**. This PATTERNS.md instead documents:

1. The file list this phase will create (from CONTEXT.md + RESEARCH.md)
2. The naming/structure conventions RESEARCH.md prescribes, which this phase establishes and all future phases (2, 3...) must follow as their analog baseline
3. Concrete code skeletons from RESEARCH.md's `## Code Examples` section, since those are the closest thing to "patterns to copy from" available at this point

**Action for planner:** Since there are no in-repo analogs, plan file actions using the RESEARCH.md Code Examples directly (cited below) rather than "copy from existing file X." Treat this phase's own output as the canonical analog set for Phase 2/3 pattern-mapping.

## File Classification

| New File | Role | Data Flow | Analog | Source of Truth |
|----------|------|-----------|--------|------------------|
| `vite.config.ts` | config | — | none | RESEARCH.md Code Examples: `vite.config.ts` |
| `index.html` | config | — | none | RESEARCH.md "Resolved Discretion Decisions #1" (redirect-restore inline script) |
| `404.html` | config | — | none | RESEARCH.md "Resolved Discretion Decisions #1" (`rafgraph/spa-github-pages`) |
| `.github/workflows/deploy.yml` | config (CI) | event-driven | none | RESEARCH.md Code Examples: `.github/workflows/deploy.yml` |
| `src/main.tsx` | entrypoint | — | none | RESEARCH.md Code Examples: `src/main.tsx` |
| `src/App.tsx` | component (root) | — | none | RESEARCH.md Recommended Project Structure |
| `src/router.tsx` | route | request-response | none | RESEARCH.md architecture diagram (`BrowserRouter basename`, `/` and `/enquesta/:id`) |
| `src/index.css` | config (styling) | — | none | RESEARCH.md Code Examples: Tailwind v4 dark-mode `@custom-variant` |
| `src/types/enquesta.ts` | model (types) | — | none | RESEARCH.md `SurveyIndexEntry` shape in `HomePage.tsx` example |
| `src/pages/HomePage.tsx` | component (page) | request-response (fetch JSON) | none | RESEARCH.md Code Examples: `HomePage.tsx` (loading/error/empty/grid states) |
| `src/pages/ExplorerPage.tsx` | component (page, stub) | — | none | RESEARCH.md Anti-Patterns: `React.lazy()` stub for Phase 3 |
| `src/components/SurveyCard.tsx` | component | — | none | RESEARCH.md Recommended Project Structure + CONTEXT.md D-03 (text-only card) |
| `src/components/SurveyGrid.tsx` | component | — | none | RESEARCH.md Recommended Project Structure |
| `src/components/SurveySummaryModal.tsx` | component | request-response (fetch `[id]_meta.json`) | none | RESEARCH.md "Resolved Discretion Decisions #2" |
| `src/components/EmptyState.tsx` | component | — | none | RESEARCH.md "Resolved Discretion Decisions #3" |
| `src/components/ErrorState.tsx` | component | — | none | RESEARCH.md Code Examples: `HomePage.tsx` (`ErrorState` usage) |
| `src/components/ThemeToggle.tsx` | component | — | none | RESEARCH.md Code Examples: `useTheme.ts` consumer |
| `src/hooks/useTheme.ts` | hook | — | none | RESEARCH.md Code Examples: `useTheme.ts` (full implementation) |
| `public/data/enquestes_index.json` | config (data fixture) | file-I/O | none | RESEARCH.md "Resolved Discretion Decisions #3" — ship literal `[]` |
| `package.json` / `tsconfig*.json` / `eslint.config.js` | config | — | none | Scaffolded verbatim by `npm create vite@latest -- --template react-ts` per RESEARCH.md Installation section |

## Pattern Assignments

### `vite.config.ts` (config)

**Source:** RESEARCH.md Code Examples

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/enquestes/', // must match the GitHub repo name — CITED: vite.dev/guide/static-deploy
  plugins: [react(), tailwindcss()],
})
```

Note: `base` must exactly match the GitHub repo name (`enquestes`) with leading/trailing slashes — this is the single source of truth all other files derive `import.meta.env.BASE_URL` from.

---

### `src/main.tsx` (entrypoint)

**Source:** RESEARCH.md Code Examples

```typescript
import { BrowserRouter } from 'react-router-dom'
// basename should match vite's `base` — read it from Vite's own env var so the two never drift apart
<BrowserRouter basename={import.meta.env.BASE_URL}>
  <App />
</BrowserRouter>
```

Must also include the `spa-github-pages` redirect-restore inline script (runs before `ReactDOM.render`/`createRoot` mount) — see `index.html` below; the restore logic itself typically lives inline in `index.html`'s `<head>`, not in `main.tsx`.

---

### `src/hooks/useTheme.ts` (hook)

**Source:** RESEARCH.md Code Examples — full implementation, copy verbatim as the starting point

```typescript
import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }
}
```

Paired CSS (`src/index.css`):
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

Satisfies CONTEXT.md D-02 (dark mode toggle, defaults to `prefers-color-scheme`).

---

### `src/pages/HomePage.tsx` (component/page, request-response)

**Source:** RESEARCH.md Code Examples — this is the canonical fetch/state-machine pattern that `SurveySummaryModal.tsx` should mirror for its own `[id]_meta.json` fetch

```typescript
import { useEffect, useState } from 'react'

type SurveyIndexEntry = { id: string; title: string; date: string; description: string; n: number }
type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; surveys: SurveyIndexEntry[] }

export function HomePage() {
  const [state, setState] = useState<FetchState>({ status: 'loading' })

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/enquestes_index.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error('Format inesperat')
        setState({ status: 'success', surveys: data as SurveyIndexEntry[] })
      })
      .catch((err) =>
        setState({ status: 'error', message: 'No s\'ha pogut carregar el llistat d\'enquestes.' }),
      )
  }, [])

  if (state.status === 'loading') return <LoadingSkeleton />
  if (state.status === 'error') return <ErrorState message={state.message} />
  if (state.surveys.length === 0) return <EmptyState />
  return <SurveyGrid surveys={state.surveys} />
}
```

**Key rules embedded in this pattern (apply everywhere data is fetched, including `SurveySummaryModal.tsx`):**
- Always build URLs via `` `${import.meta.env.BASE_URL}data/...` `` — never a hardcoded leading-slash path (Pitfall 3).
- Validate shape at the trust boundary (`Array.isArray`, required-field checks) before casting to a typed value (ASVS V5).
- Four distinct states: `loading` → `error` → `empty` (`[]`) → `success`/grid. Error and empty must render visibly different UI/copy (HOME-02 vs the empty-catalog decision).
- Never use `dangerouslySetInnerHTML` on `title`/`description` fields — plain JSX interpolation auto-escapes.

---

### `404.html` + `index.html` redirect pair (config)

**Source:** RESEARCH.md "Resolved Discretion Decisions #1", citing `github.com/rafgraph/spa-github-pages`

- `404.html` (in `public/404.html` so Vite copies it to `dist/` — Pitfall 4) runs a script encoding the requested path into a `?/...` query-string redirect to `/enquestes/`, using `pathSegmentsToKeep = 1`.
- `index.html` runs a small inline script (before React mounts) that detects the `?/...` marker and calls `history.replaceState(...)` to restore the real path, so `<BrowserRouter basename={import.meta.env.BASE_URL}>` sees the correct URL.
- Do not hand-write a custom encoder — use the verbatim `rafgraph/spa-github-pages` script pair (see "Don't Hand-Roll" in RESEARCH.md).

---

### `.github/workflows/deploy.yml` (config, event-driven CI)

**Source:** RESEARCH.md Code Examples — copy verbatim, only adjust if action versions have moved since 2026-08-25

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: './dist'
      - id: deployment
        uses: actions/deploy-pages@v5
```

Least-privilege `permissions:` block is mandatory (ASVS V14) — never `write-all` or an omitted block.

---

### `public/data/enquestes_index.json` (data fixture, file-I/O)

**Source:** RESEARCH.md "Resolved Discretion Decisions #3"

Ship the literal content `[]` this phase. This is the locked schema contract Phase 2's conversion script must upsert into — array of `{id, title, date, description, n}` objects, matching `SurveyIndexEntry` in `HomePage.tsx`. Do not omit this file (a missing file produces a 404/error state, not the intended empty state).

## Shared Patterns

### Base-path-aware data fetching
**Source:** RESEARCH.md Anti-Patterns / Pitfall 3
**Apply to:** `HomePage.tsx`, `SurveySummaryModal.tsx`, any future component fetching `public/data/*`
```typescript
fetch(`${import.meta.env.BASE_URL}data/enquestes_index.json`)
```
Never hardcode `/data/...`. Single source of truth is `vite.config.ts`'s `base`.

### Fetch state machine (loading/error/empty/success)
**Source:** RESEARCH.md `HomePage.tsx` example
**Apply to:** `HomePage.tsx` (index fetch) and `SurveySummaryModal.tsx` (per-survey meta fetch) — same four-state shape, same shape-validation-before-render discipline.

### Route-level lazy loading for Explorer
**Source:** RESEARCH.md Anti-Patterns
**Apply to:** `router.tsx` — `ExplorerPage` must be a `React.lazy()` import so Phase 3's DuckDB-Wasm/GraphicWalker code doesn't bloat Phase 1's bundle.
```typescript
const ExplorerPage = React.lazy(() => import('./pages/ExplorerPage'))
```

### Dark mode via class + localStorage
**Source:** RESEARCH.md `useTheme.ts` / `index.css` examples
**Apply to:** `ThemeToggle.tsx` (consumer), `App.tsx` (mounts the class toggle), `index.css` (`@custom-variant`)

### Least-privilege GitHub Actions permissions
**Source:** RESEARCH.md Security Domain / Code Examples
**Apply to:** `.github/workflows/deploy.yml` only — this phase's sole CI file.

## No Analog Found

All 20 files below have no analog because this is the first phase of a new repository — codebase search was performed (directory listing confirms only `.claude/` and `.planning/` exist) and confirmed empty. Planner must build these directly from the RESEARCH.md Code Examples excerpted above and from RESEARCH.md's "Recommended Project Structure."

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vite.config.ts` | config | — | Greenfield repo, no prior config file |
| `index.html` | config | — | Greenfield repo |
| `404.html` | config | — | Greenfield repo |
| `.github/workflows/deploy.yml` | config | event-driven | Greenfield repo, no prior CI |
| `src/main.tsx` | entrypoint | — | Greenfield repo |
| `src/App.tsx` | component | — | Greenfield repo |
| `src/router.tsx` | route | request-response | Greenfield repo |
| `src/index.css` | config | — | Greenfield repo |
| `src/types/enquesta.ts` | model | — | Greenfield repo |
| `src/pages/HomePage.tsx` | component | request-response | Greenfield repo |
| `src/pages/ExplorerPage.tsx` | component (stub) | — | Greenfield repo |
| `src/components/SurveyCard.tsx` | component | — | Greenfield repo |
| `src/components/SurveyGrid.tsx` | component | — | Greenfield repo |
| `src/components/SurveySummaryModal.tsx` | component | request-response | Greenfield repo |
| `src/components/EmptyState.tsx` | component | — | Greenfield repo |
| `src/components/ErrorState.tsx` | component | — | Greenfield repo |
| `src/components/ThemeToggle.tsx` | component | — | Greenfield repo |
| `src/hooks/useTheme.ts` | hook | — | Greenfield repo |
| `public/data/enquestes_index.json` | config (fixture) | file-I/O | Greenfield repo |
| `package.json`/`tsconfig*`/`eslint.config.js` | config | — | Auto-scaffolded by `create-vite`, not hand-authored |

## Conventions Established (for future phases' analog use)

Since Phase 2/3 will have this phase's output as their first available analog set, note these conventions explicitly so they're followed consistently:

- **Naming:** PascalCase for component files (`SurveyCard.tsx`), camelCase for hooks prefixed `use` (`useTheme.ts`), lowercase for config/entrypoint (`main.tsx`, `router.tsx`).
- **Directory structure:** `src/{types,pages,components,hooks}` — flat within each, no further nesting at this scale.
- **Data fetching:** always via `import.meta.env.BASE_URL` prefix, never hardcoded paths; explicit `loading/error/empty/success` state union type, not booleans.
- **Styling:** Tailwind v4 CSS-first (`@import "tailwindcss"`), no `tailwind.config.js`, no PostCSS config.
- **Language:** UI copy in Catalan (per CONTEXT.md); code/comments in English.
- **Data contract:** `public/data/enquestes_index.json` is an array of `{id, title, date, description, n}` — Phase 2 must not change this shape without renegotiating with Phase 1/3 consumers.

## Metadata

**Analog search scope:** Entire working directory (`/Users/marcaragones/Github/enquestes`), confirmed via `find`/`ls` to contain only `.claude/` and `.planning/` besides `.git/`
**Files scanned:** 0 source files (none exist)
**Pattern extraction date:** 2026-08-25
