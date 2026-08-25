# Phase 1: Foundation & Survey Listing - Research

**Researched:** 2026-08-25
**Domain:** Vite/React/TypeScript/Tailwind SPA scaffold, GitHub Actions → GitHub Pages deploy, JSON-only survey listing UI
**Confidence:** HIGH (deploy pattern, routing pattern, package versions — verified via `npm view` and official docs this session) / MEDIUM (UI-flow discretion calls — reasoned recommendations, not externally mandated)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Disseny visual**
- **D-01:** Paleta de colors neutra/minimalista — blanc-negre-grisos amb un sol color d'accent, look tipus dashboard de dades seriós
- **D-02:** Suport per dark mode amb toggle — l'usuari pot canviar entre clar/fosc; per defecte respecta la preferència del sistema (`prefers-color-scheme`)
- **D-03:** Targetes d'enquesta només amb text (títol, data, descripció, N participants) — sense imatge, icona ni emoji, focus en la informació
- **D-04:** Estil tipogràfic modern/tech — sans-serif net, tipus eina SaaS/dashboard de dades (no editorial/càlid)

### Claude's Discretion

- **Estratègia de routing** (`BrowserRouter` + `404.html` redirect trick vs `HashRouter`) per als deep-links a `/enquesta/:id` — l'usuari va delegar aquesta decisió. Recomanació de la recerca (STACK.md): `BrowserRouter` + `404.html` per URLs netes, ja que és el patró estàndard de deploy natiu de GitHub Actions/Pages.
- **Flux del resum ràpid en clicar una targeta** (modal/panell superposat vs ruta dedicada) — l'usuari va delegar aquesta decisió.
- **Estat buit del catàleg** (què es mostra si encara no hi ha cap enquesta publicada, ja que la Fase 2 de dades pot anar en paral·lel i no estar llesta) — l'usuari va delegar aquesta decisió.
- **Idioma de la interfície** — no discutit explícitament; tot el context del projecte (PROJECT.md, converses) és en català, així que la interfície per defecte serà en català, sense necessitat de i18n per v1.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

**This research resolves the three delegated decisions below with concrete recommendations** — see "Resolved Discretion Decisions" under Architecture Patterns.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOME-01 | User pot veure una graella de targetes de totes les enquestes disponibles, amb títol, data, descripció i nombre de participants | `enquestes_index.json` fetch pattern, SurveyCard component, project structure (Architecture Patterns, Code Examples) |
| HOME-02 | User veu un missatge d'error clar si `enquestes_index.json` no es pot carregar (en lloc de pantalla en blanc) | Fetch error-state pattern + placeholder-index pitfall (Common Pitfalls, Code Examples) |
| HOME-03 | User pot clicar una targeta i veure un resum ràpid de KPIs carregat des de `[id]_meta.json`, abans d'entrar a l'explorador | Resolved discretion: modal/panel pattern (Architecture Patterns) |
| HOME-04 | User pot accedir a l'explorador complet des del resum ràpid amb un botó "Explorar dades interactives" | Routing pattern (`/enquesta/:id` route reserved for Phase 3), Link/navigate pattern |
| DEPLOY-01 | L'aplicació es desplega automàticament a GitHub Pages via GitHub Actions a cada push a `main` | GitHub Actions workflow (Code Examples), verified action versions (Standard Stack) |
| DEPLOY-02 | El build es configura amb el `base` path correcte del repositori (`enquestes`) i amb fallback SPA (404.html) perquè els deep-links funcionin | `vite.config.ts` base config + 404.html/index.html redirect pair (Code Examples) |
</phase_requirements>

## Summary

This phase scaffolds the entire application from an empty repository: a Vite + React 19 + TypeScript + Tailwind v4 SPA, a GitHub Actions workflow that deploys it to GitHub Pages on every push to `main`, and a JSON-only homepage (survey grid + quick KPI preview) with no DuckDB-Wasm/GraphicWalker dependency yet. Every package version and deploy pattern below was verified this session via `npm view` against the live npm registry and via official documentation (tailwindcss.com, reactrouter.com, vite.dev, GitHub's release API) — not carried over unverified from the earlier general-project research in `.planning/research/`.

Two verified findings materially update the general-project STACK.md research and must inform planning: (1) the ecosystem has moved to **Vite 8** and **TypeScript ~6.0.2** as the versions the official `create-vite` React+TS template now scaffolds by default — STACK.md's "stay on Vite 7 / TypeScript 5.x" guidance is superseded; use the template defaults, not those older pins. (2) Vite 7 **and** 8 both require **Node `^20.19.0 || >=22.12.0`** — the local dev machine currently runs **Node v20.18.3**, which fails this floor. Upgrading Node is a hard Wave-0 prerequisite regardless of which Vite line is chosen (there is no older-Vite escape hatch — 7.3.6 has the identical floor).

For the two delegated UX decisions: use **`BrowserRouter` + the `404.html`/`index.html` redirect-pair pattern** (the well-known `rafgraph/spa-github-pages` technique) for clean URLs, matching STACK.md's steer and the project's native GitHub Actions deploy flow. Present the per-survey KPI quick-look as a **modal/panel over the homepage** (not a separate route) — this matches the file layout already implied in ARCHITECTURE.md (`SurveySummaryModal.tsx`), keeps the homepage's first paint fast (no route change, no explorer-page code loaded), and cleanly reserves `/enquesta/:id` exclusively for the Phase 3 full explorer, satisfying HOME-04's "navigate from quick-look to full explorer" flow. For the empty catalog, ship this phase with a placeholder `public/data/enquestes_index.json` containing `[]` so the homepage renders a distinct **"no surveys published yet"** empty state instead of a fetch error before Phase 2's data pipeline lands.

**Primary recommendation:** Scaffold with `npm create vite@latest -- --template react-ts` (after upgrading Node), add Tailwind v4 via `@tailwindcss/vite`, add `react-router-dom` in plain declarative mode with `basename` matching the Vite `base`, and deploy via the official `actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages` GitHub Actions flow with a `404.html` copy-of-`index.html` step plus the `spa-github-pages` redirect script pair.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Survey card grid rendering | Browser / Client | — | Pure React component tree; no server involved at any point |
| `enquestes_index.json` / `[id]_meta.json` fetch + parse | Browser / Client | CDN / Static | `fetch()` runs client-side; the JSON files themselves are served as static assets from `public/data/` via GitHub Pages/Fastly |
| Quick KPI modal/panel | Browser / Client | — | Local component state on the homepage; no route change, no new page load |
| Client-side routing (`/`, `/enquesta/:id` placeholder) + deep-link fallback | Browser / Client | CDN / Static | `BrowserRouter` runs client-side, but the `404.html` fallback that makes deep links work is a static-hosting-level mechanism GitHub Pages must serve |
| Dark/light theme toggle | Browser / Client | — | CSS class + `localStorage`, no server state |
| Build (Vite bundling, `base` path resolution) | CDN / Static | — | Build output is static files; "server" tier does not exist in this architecture |
| CI/CD deploy pipeline (GitHub Actions → Pages) | CDN / Static | — | The only "server-side" step in the whole system; runs before any visitor loads the app, not at request time |

There is no Frontend-Server(SSR), API/Backend, or Database/Storage tier in this phase — confirmed by PROJECT.md's explicit "no backend, $0 cost" constraint and corroborated by ARCHITECTURE.md's system diagram (`.planning/research/ARCHITECTURE.md:9-55`).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | `^19.2.8` `[VERIFIED: npm registry, 2026-08-25]` | UI library | Mandated by PROJECT.md; current stable major |
| `react-dom` | `^19.2.8` `[VERIFIED: npm registry, 2026-08-25]` | DOM renderer | Pairs with `react` |
| `vite` | `^8.2.2` `[VERIFIED: npm registry + vite.dev official docs, 2026-08-25]` | Build tool / dev server | Current `latest` tag on npm; is what `npm create vite@latest` now scaffolds. Requires Node `^20.19.0 \|\| >=22.12.0` — see Environment Availability. |
| `typescript` | `~6.0.2` `[VERIFIED: npm registry + create-vite template source, 2026-08-25]` | Type safety | **Not** the newest `typescript@7.0.2` (`latest` tag) — see Common Pitfalls. `~6.0.2` is exactly what the official `create-vite` `template-react-ts/package.json` currently pins, chosen specifically because it stays under `typescript-eslint`'s peer ceiling (`<6.1.0`, verified via `npm view typescript-eslint peerDependencies`) |
| `tailwindcss` | `^4.3.3` `[VERIFIED: npm registry + tailwindcss.com official docs, 2026-08-25]` | Styling | Mandated by PROJECT.md; v4's CSS-first config removes `tailwind.config.js`/PostCSS boilerplate |
| `@tailwindcss/vite` | `^4.3.3` `[VERIFIED: npm registry + tailwindcss.com official docs, 2026-08-25]` | Tailwind's dedicated Vite plugin | One plugin line + `@import "tailwindcss";` — no PostCSS config needed |
| `react-router-dom` | `^7.18.2` `[VERIFIED: npm registry + reactrouter.com official docs, 2026-08-25]` | Client-side routing: `/` and `/enquesta/:id` | Declarative-mode `BrowserRouter`/`Routes`/`Route`; depends directly on `react-router@7.18.2` internally (confirmed via `npm view react-router-dom dependencies`) — install `react-router-dom`, not the bare `react-router` package, for a browser app |
| `@vitejs/plugin-react` | `^6.1.0` `[VERIFIED: npm registry + create-vite template source, 2026-08-25]` | Vite's official React plugin (Fast Refresh, JSX transform) | What the current template pins for Vite 8; its extra peers (`oxc-transform-react`, `@rolldown/plugin-babel`, `babel-plugin-react-compiler`) are all `optional: true` — no need to install them |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | `^1.34.0` `[ASSUMED — package name from prior STACK.md research/training knowledge, not independently confirmed via an official doc fetch this session; registry existence + legitimacy check below do not upgrade this to VERIFIED per provenance rules]` | Icon set (back-arrow, sun/moon toggle icons, chart-type chrome) | Small amount of chrome UI around the survey grid and modal; tree-shakeable, matches Tailwind's utility-first aesthetic |
| `eslint` + `typescript-eslint` | Whatever `npm create vite@latest -- --template react-ts` pins (flat-config `eslint.config.js`) | Linting | Ships by default with the template; do not hand-pick versions — the template's combination is what's tested to be mutually compatible (see Common Pitfalls) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `BrowserRouter` + `404.html` redirect | `HashRouter` | `HashRouter` produces uglier URLs (`.../enquestes/#/enquesta/id`) but needs zero GitHub Pages configuration and can never 404 on refresh. CONTEXT.md's discretion note already leans toward `BrowserRouter`; this research confirms and details the implementation (see Architecture Patterns). |
| Modal/panel for quick KPI summary | Dedicated route (e.g. `/enquesta/:id/resum`) | A dedicated route would make the quick-look independently deep-linkable/shareable, but adds route complexity and risks colliding conceptually with the Phase-3 `/enquesta/:id` explorer route. Not required by any HOME-0x requirement; deferred as a v1.x nice-to-have, not v1 scope. |
| Hand-written dark-mode toggle (Tailwind `@custom-variant` + tiny React hook) | A theming library (`next-themes`-style package) | The app has exactly one binary theme toggle with `localStorage` persistence — a ~15-line custom hook is simpler than adding a dependency for this scope (see Don't Hand-Roll for the boundary of what *is* worth not hand-rolling). |

**Installation:**
```bash
# Prerequisite: Node must satisfy vite's engine floor — see Environment Availability
node --version   # must be >=20.19.0 or >=22.12.0

# Scaffold (official Vite React+TS template — currently pins vite ^8.2.2, typescript ~6.0.2, @vitejs/plugin-react ^6.1.0)
npm create vite@latest . -- --template react-ts

# Styling
npm install tailwindcss @tailwindcss/vite

# Routing + icons
npm install react-router-dom lucide-react

# Re-verify exact current versions before finalizing package.json:
npm view vite version
npm view typescript version
npm view react-router-dom version
```

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|--------------|---------|-------------|
| `react` | npm | 2026-07-21 | 172,436,932 | github.com/react/react | OK | Approved |
| `react-dom` | npm | 2026-07-21 | 161,510,683 | github.com/react/react | OK | Approved |
| `vite` | npm | 2026-08-20 | 171,647,528 | github.com/vitejs/vite | SUS (`too-new`) | Approved — heuristic false-positive: 171M weekly downloads, official `vitejs` org repo, publish date is a normal release cadence, not a slopsquat signal. No checkpoint needed. |
| `typescript` | npm | 2026-07-08 | 273,257,696 | github.com/microsoft/TypeScript | OK | Approved |
| `tailwindcss` | npm | 2026-07-16 | 126,443,545 | github.com/tailwindlabs/tailwindcss | OK | Approved |
| `@tailwindcss/vite` | npm | 2026-07-16 | 46,355,115 | github.com/tailwindlabs/tailwindcss | OK | Approved |
| `react-router-dom` | npm | 2026-07-28 | 43,047,384 | github.com/remix-run/react-router | SUS (`too-new`) | Approved — same false-positive pattern (43M weekly downloads, official `remix-run` org). No checkpoint needed. |
| `lucide-react` | npm | 2026-08-24 | 97,191,690 | github.com/lucide-icons/lucide | SUS (`too-new`) | **Flag per protocol** — package name itself is `[ASSUMED]` (not confirmed via an official-doc fetch this session, only via prior STACK.md/training knowledge), *and* the legitimacy heuristic independently flagged it. Planner should add a lightweight `checkpoint:human-verify` before this specific install (glance at the GitHub repo/npm page — 97M weekly downloads and the `lucide-icons` org make it almost certainly fine, but it's the one package in this list not corroborated by an official doc fetch). |
| `@vitejs/plugin-react` | npm | 2026-08-20 | 84,161,172 | github.com/vitejs/vite-plugin-react | SUS (`too-new`) | Approved — official `vitejs` org, matches the create-vite template's own pin. No checkpoint needed. |
| `eslint` | npm | 2026-08-24 | 159,688,201 | github.com/eslint/eslint | SUS (`too-new`) | Approved — bundled by the official Vite template, not independently chosen. |
| `typescript-eslint` | npm | 2026-08-24 | 88,554,617 | github.com/typescript-eslint/typescript-eslint | SUS (`too-new`) | Approved — bundled by the official Vite template; its documented `typescript` peer ceiling (`<6.1.0`) is exactly why `typescript` must stay at `~6.0.2` (see Common Pitfalls). |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `lucide-react` — planner should insert one `checkpoint:human-verify` task before its install; all other `SUS` verdicts in this audit are the legitimacy heuristic's `too-new` recency check firing on extremely well-established, high-download, official-org packages (a documented heuristic limitation, not a real risk signal) and do not need a checkpoint.

*Note on the `too-new` pattern above: seven of eleven packages in this audit triggered `too-new` purely because their latest published version is within days of this research date — normal for actively maintained tooling (React, Vite, ESLint, etc. all ship frequently). Cross-referencing downloads/repo for each before dismissing the flag, per protocol, is exactly what this table does.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  GitHub Actions (on push to main)                                │
│  checkout → setup-node → npm ci → vite build → configure-pages   │
│  → upload-pages-artifact(dist/) → deploy-pages                   │
└───────────────────────────────┬───────────────────────────────────┘
                                 │ static files published
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  GitHub Pages (static host, base: /enquestes/)                    │
│  serves: index.html, 404.html, assets/*, data/enquestes_index.json│
└───────────────────────────────┬───────────────────────────────────┘
                                 │ browser navigation
        ┌────────────────────────┴─────────────────────────┐
        │ Direct load of "/" or in-app nav                   │ Direct load / refresh of "/enquesta/:id"
        ▼                                                     ▼
┌───────────────────┐                              ┌─────────────────────────┐
│ index.html loads   │                              │ GitHub Pages 404.html    │
│ normally            │                              │ intercepts, encodes path │
└─────────┬───────────┘                              │ as query string, redirects│
          │                                          │ to index.html             │
          ▼                                          └─────────────┬─────────────┘
┌────────────────────────┐                                          │
│ React app boots          │◀────────────────────────────────────────┘
│ (index.html redirect-    │  index.html's inline script restores the
│  restore script runs      │  real path via history.replaceState(...)
│  before ReactDOM.render)  │  BEFORE React Router reads the URL
└─────────┬─────────────────┘
          ▼
┌────────────────────────────────────────────┐
│ <BrowserRouter basename="/enquestes">        │
│  Route "/"        → HomePage                 │
│  Route "/enquesta/:id" → (Phase 3 stub route) │
└─────────┬────────────────────────────────────┘
          ▼
┌──────────────────────────────────────────────────────────┐
│ HomePage                                                    │
│  useEffect: fetch(`${BASE_URL}data/enquestes_index.json`)  │
│    - success, non-empty → render SurveyCard grid            │
│    - success, empty array → render "no surveys yet" state   │
│    - fetch/parse error → render error message (HOME-02)     │
│  onCardClick(id):                                            │
│    → open SurveySummaryModal                                  │
│    → fetch(`${BASE_URL}data/enquestes/${id}_meta.json`)       │
│    → render KPI cards + "Explorar dades interactives" button  │
│         → navigates to /enquesta/:id (Phase 3 route)          │
└──────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
enquestes/
├── public/
│   └── data/
│       └── enquestes_index.json     # [] placeholder shipped THIS phase (see Common Pitfalls)
├── src/
│   ├── types/
│   │   └── enquesta.ts              # TS types mirroring index.json / meta.json shape
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   └── ExplorerPage.tsx         # Phase-1 stub: route exists, renders placeholder; Phase 3 fills it in
│   ├── components/
│   │   ├── SurveyCard.tsx
│   │   ├── SurveyGrid.tsx
│   │   ├── SurveySummaryModal.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ErrorState.tsx
│   │   └── ThemeToggle.tsx
│   ├── hooks/
│   │   └── useTheme.ts              # dark/light + localStorage + prefers-color-scheme default
│   ├── router.tsx
│   ├── App.tsx
│   └── main.tsx
├── index.html                       # includes the spa-github-pages redirect-restore script
├── 404.html                         # spa-github-pages redirect script (or built by a Vite plugin — see Code Examples)
├── vite.config.ts                   # base: '/enquestes/'
└── .github/workflows/deploy.yml
```

This matches `.planning/research/ARCHITECTURE.md`'s recommended structure (`.planning/research/ARCHITECTURE.md:70-103`), with `services/duckdb.ts` and the DuckDB-specific pieces deferred to Phase 3 as that research already scopes.

### Resolved Discretion Decisions

**1. Routing strategy — `BrowserRouter` + `404.html` redirect (confirmed)**

Use the `rafgraph/spa-github-pages` pattern `[CITED: github.com/rafgraph/spa-github-pages]`:
- `404.html` (served by GitHub Pages for any unknown path) runs a script that encodes the requested path+query into a query-string-only redirect to `/enquestes/` (e.g. `/enquestes/enquesta/abc123` → `/enquestes/?/enquesta/abc123`), with `pathSegmentsToKeep = 1` so the `/enquestes` repo-name segment survives the redirect.
- `index.html` includes a small inline script, running **before** the React bundle mounts, that detects the `?/...` marker and calls `window.history.replaceState(...)` to restore the real path.
- `<BrowserRouter basename="/enquestes">` (or `basename={import.meta.env.BASE_URL}`) then sees the correct, restored path.
- This is a refresh-safe, shareable-URL-preserving pattern — a direct load or reload of a card's quick-look/explorer link works, satisfying the spirit of DEPLOY-02's "fallback SPA" requirement even though HOME-0x itself only needs `/` to work in Phase 1 (the explorer route is stubbed, not fully built, until Phase 3).

**2. Quick-summary flow — modal/panel over the homepage (not a dedicated route)**

- Clicking a `SurveyCard` opens a `SurveySummaryModal` as an overlay on `HomePage`, driven by local component state (`selectedSurveyId`), not a route change.
- The modal triggers its own `fetch('${BASE_URL}data/enquestes/${id}_meta.json')` on open and renders KPI cards from the response.
- The "Explorar dades interactives" button (HOME-04) calls `navigate('/enquesta/${id}')` via `useNavigate()`, handing off to the (Phase-3-built) `ExplorerPage`.
- Rationale: keeps the homepage's initial load cheap (no extra route/page component tree mounted just to preview), matches the component name already anticipated in ARCHITECTURE.md (`SurveySummaryModal.tsx`, `.planning/research/ARCHITECTURE.md:96`), and avoids creating a third URL shape that would need its own 404.html-path handling this phase.
- Not a requirement, but cheap to add: reflect the open modal in the URL via `useSearchParams` (`?enquesta=<id>`) purely so the browser Back button closes the modal — optional polish, not required for HOME-03/04 compliance.

**3. Empty-catalog behavior — ship a `[]` placeholder index, render a dedicated empty state**

- This phase commits `public/data/enquestes_index.json` containing the literal JSON `[]` as part of the scaffold (before Phase 2's data pipeline ever runs). This guarantees the fetch **succeeds** with zero results rather than 404ing, which matters because HOME-02's error state and the empty-catalog state must look and read differently to the user — a 404 read as "broken deploy," while `[]` reads as "genuinely nothing published yet."
- `HomePage` renders three distinct states from the fetch: `loading` → `error` (HOME-02, fetch/parse failure) → `empty` (`[]`, "Encara no hi ha cap enquesta publicada. Torna aviat!") → `grid` (≥1 survey).
- This is a Phase 1 decision with a direct Phase 2 handoff: Phase 2's conversion script upserts into this same file — the schema (array of `{id, title, date, description, n}`) must be locked now so Phase 2 doesn't need to renegotiate it.

### Anti-Patterns to Avoid

- **Fetching data with a hardcoded absolute path (`/data/enquestes_index.json`):** breaks under the `/enquestes/` base path. Always prefix with `import.meta.env.BASE_URL` (Vite's exposed base-path env var) — e.g. `` `${import.meta.env.BASE_URL}data/enquestes_index.json` `` — confirmed necessary by `.planning/research/PITFALLS.md`'s "Base path correctness" checklist item (`.planning/research/PITFALLS.md:214`).
- **Eagerly importing the Explorer route's future DuckDB/GraphicWalker code from `App.tsx` or the router's top-level import:** even though those libraries aren't installed until Phase 3, structure `ExplorerPage` as a route-level `React.lazy()` import now so Phase 3 doesn't need to refactor the routing shape — keeps HomePage's bundle small from day one.
- **Skipping the `404.html`/`index.html` redirect pair "for now" and adding it later:** DEPLOY-02 explicitly requires it, and retrofitting after real survey links have been shared means old shared links may have already been indexed/bookmarked in a shape that won't redirect correctly — do it in this phase's scaffold, not deferred.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| GitHub Pages SPA-deep-link redirect encoding | A custom path→query-string encoder | The verbatim `rafgraph/spa-github-pages` `404.html`/`index.html` script pair | This is a well-tested, widely-deployed exact-string algorithm (segment counting via `pathSegmentsToKeep`, character-safe encoding); subtle encoding bugs (e.g. mishandling `~` as the escape character, or off-by-one `pathSegmentsToKeep`) are easy to introduce and hard to notice until a real deep link is shared and breaks |
| GitHub Actions Pages deploy | A hand-rolled `gh-pages` branch push script, or the third-party `peaceiris/actions-gh-pages` action | The official `actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages` trio (Pages "Source: GitHub Actions") | This is GitHub's own current, native deploy mechanism — no extra branch, no extra npm devDependency, and it's what GitHub scaffolds by default for new repos today |
| Base-path-aware asset/data URLs | Manually string-concatenating `/enquestes/` everywhere | `import.meta.env.BASE_URL` (Vite's built-in env var, always reflects the `base` config) | Single source of truth; changing `vite.config.ts`'s `base` later (e.g. repo rename) then requires zero code changes elsewhere |

**Key insight:** everything hand-rollable in this phase's *own* scope (empty/error/loading state components, the KPI modal, the dark-mode toggle) is intentionally small and app-specific — the things flagged above are hand-roll traps precisely because they look like "just a redirect script" or "just a deploy script" but encode non-obvious platform-specific edge cases (GitHub Pages' lack of server rewrites, GitHub's current Pages API) that off-the-shelf, battle-tested patterns already solve correctly.

## Common Pitfalls

### Pitfall 1: `typescript@latest` (7.0.2) breaks `typescript-eslint`

**What goes wrong:** Running `npm install -D typescript` without a version pin installs `typescript@7.0.2` (the current `latest` npm dist-tag). `typescript-eslint@8.68.0`'s `peerDependencies` declares `"typescript": ">=4.8.4 <6.1.0"` `[VERIFIED: npm view typescript-eslint peerDependencies, 2026-08-25]` — TypeScript 7.0 falls outside that range. TypeScript 7.0 also ships without a stable programmatic compiler API (that lands in 7.1); `typescript-eslint` and similar tools cannot use it yet.
**Why it happens:** `npm install -D typescript` with no version specifier always resolves to the `latest` tag, which moved to the new Go-native 7.0 line ahead of the ESLint tooling ecosystem catching up.
**How to avoid:** Do not run a bare `npm install -D typescript`. Either accept whatever the `create-vite react-ts` template already pins in `package.json` (currently `~6.0.2`, verified via the template's own source), or if adding TypeScript manually, pin explicitly: `npm install -D typescript@~6.0.2`.
**Warning signs:** `npm install` peer-dependency warnings mentioning `typescript-eslint` and a TypeScript version conflict; ESLint's TS-aware rules silently not type-checking.

### Pitfall 2: Local Node version (`v20.18.3`) is below Vite 7/8's engine floor

**What goes wrong:** Both `vite@7.3.6` and `vite@8.2.2` declare `"engines": { "node": "^20.19.0 || >=22.12.0" }` `[VERIFIED: npm view vite@7.3.6 engines / vite@8.2.2 engines, 2026-08-25]`. The scaffolding machine's installed Node is `v20.18.3` (confirmed via `node --version` this session), which satisfies neither range.
**Why it happens:** `20.18.3 < 20.19.0` — Node's own semver ordering means this isn't caught by a caret range that "looks close enough."
**How to avoid:** Upgrade Node **before** scaffolding, e.g. `nvm install 22 && nvm use 22` (or any Node ≥20.19.0). This is unavoidable regardless of which Vite major is chosen — there is no "downgrade to an older Vite" escape, since 7.3.6 has the identical floor.
**Warning signs:** `npm install`/`npm create vite@latest` emitting an `EBADENGINE` warning, or `vite`/`vite build` failing to start with a cryptic syntax/runtime error tied to a Node API introduced in 20.19.

### Pitfall 3: Fetching `enquestes_index.json` with a path that ignores the `base` config

**What goes wrong:** In local dev (`vite dev`, served from `/`), `fetch('/data/enquestes_index.json')` works. After deploy under `base: '/enquestes/'`, the same hardcoded absolute path 404s, because the file actually lives at `/enquestes/data/enquestes_index.json`.
**Why it happens:** Dev server and production build resolve the app root differently unless the code explicitly accounts for `base`.
**How to avoid:** Always build data-fetch URLs from `import.meta.env.BASE_URL`, never a hardcoded leading-slash path. Verify with `vite build && vite preview --base=/enquestes/` before trusting it, per `.planning/research/PITFALLS.md`'s "Looks Done But Isn't" checklist (`.planning/research/PITFALLS.md:214`).
**Warning signs:** Grid renders correctly on `localhost:5173` but shows the error state (HOME-02) or an empty grid on the deployed `github.io` URL.

### Pitfall 4: Missing the `404.html` in the deploy artifact

**What goes wrong:** `actions/upload-pages-artifact` with `path: './dist'` only uploads what Vite actually built into `dist/`. If `404.html` isn't placed where Vite copies it into `dist/` (typically the project's `public/` root, or an explicit post-build copy step), the deploy artifact won't include it, and deep links keep 404ing even though the redirect script logic is correct.
**Why it happens:** Vite copies `public/*` to `dist/` verbatim; a `404.html` authored anywhere else (e.g. project root, `src/`) won't be picked up automatically.
**How to avoid:** Place `404.html` in `public/404.html` (or add an explicit `cp index.html dist/404.html`-style step in the workflow, run *after* `vite build`) and verify its presence in `dist/` before the artifact-upload step.
**Warning signs:** `dist/404.html` missing after a local `vite build`; deep-linked routes 404 on the live site even after the redirect scripts are written correctly.

## Code Examples

### `vite.config.ts` — base path + Tailwind plugin

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/enquestes/', // must match the GitHub repo name — CITED: vite.dev/guide/static-deploy
  plugins: [react(), tailwindcss()],
})
```

### `src/main.tsx` — router basename from Vite's own base

```typescript
// src/main.tsx
import { BrowserRouter } from 'react-router-dom'
// basename should match vite's `base` — read it from Vite's own env var so the two never drift apart
<BrowserRouter basename={import.meta.env.BASE_URL}>
  <App />
</BrowserRouter>
```

### Tailwind v4 dark mode — class-based toggle overriding the `prefers-color-scheme` default

```css
/* src/index.css — CITED: tailwindcss.com/docs/dark-mode */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

```typescript
// src/hooks/useTheme.ts — respects prefers-color-scheme on first load (D-02), then persists a manual toggle
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

### `HomePage.tsx` — loading / error / empty / grid states (HOME-01, HOME-02)

```typescript
// src/pages/HomePage.tsx
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

### `.github/workflows/deploy.yml` — native GitHub Actions Pages deploy

```yaml
# CITED: vite.dev/guide/static-deploy ; action version tags CITED: api.github.com/repos/actions/*/releases/latest
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| STACK.md's guidance: pin Vite to the "7.x line", stay on TypeScript "5.7–5.9" | Use the current `create-vite react-ts` template defaults: Vite `^8.2.2`, TypeScript `~6.0.2` | Verified this session (2026-08-25) against the live npm registry and the template's own source — STACK.md was written the same day but from unverified WebSearch summaries (its own confidence note flags version numbers as LOW) | Plan against the verified versions in this document's Standard Stack table, not STACK.md's version table |
| `tailwind.config.js` + PostCSS + `darkMode: 'class'` (Tailwind v3 pattern) | CSS-first `@import "tailwindcss";` + `@custom-variant dark (...)` in the CSS entry file (Tailwind v4) | Tailwind v4 (current) | No `tailwind.config.js` needed for this project's scope; dark-mode class toggling is now a one-line CSS directive, not a JS config key |
| `gh-pages` npm package pushing to a `gh-pages` branch | `actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages`, Pages "Source: GitHub Actions" | Long-standing GitHub-native pattern, reconfirmed current via GitHub's release API this session | This is the only deploy mechanism this phase should implement — no `gh-pages` branch, no extra npm devDependency |

**Deprecated/outdated:**
- `HashRouter` as the *default* recommendation for this project: viable and simpler, but superseded here by the confirmed `BrowserRouter` + `404.html` decision (see Resolved Discretion Decisions) per the user's own steer in CONTEXT.md.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `lucide-react` is the correct, non-hallucinated package name for the intended icon library | Standard Stack / Package Legitimacy Audit | Low-medium — if wrong, `npm install` would simply fail to resolve or install an unrelated package; mitigated by a required `checkpoint:human-verify` before this specific install (flagged in the audit table) |
| A2 | The empty-catalog UX copy/behavior recommended here (ship `[]` placeholder, distinct "no surveys yet" state) matches what the user actually wants, since it was explicitly delegated to Claude's discretion in CONTEXT.md rather than locked | Architecture Patterns → Resolved Discretion Decisions #3 | Low — purely a UX/copy decision, trivial to adjust later; does not affect data schema or architecture |
| A3 | The modal/panel (not dedicated route) presentation for the quick KPI summary is the right interpretation of "Claude's discretion" in CONTEXT.md, given it wasn't explicitly re-confirmed with the user after this research | Architecture Patterns → Resolved Discretion Decisions #2 | Medium — if the user actually wanted a shareable dedicated-route summary page, this would require adding a new route later; mitigated by the fact HOME-03/04 don't require deep-linkability, so no rework of Phase-3-facing contracts is needed either way |

## Open Questions

1. **Exact survey count expected at Phase 1 completion**
   - What we know: Phase 2 (data pipeline) may run in parallel and might not have published any real survey by the time Phase 1 ships.
   - What's unclear: Whether the demo/mock survey (`generate_mock_parquet.py`, Phase 2 scope) will be available for Phase 1's own manual verification, or whether Phase 1 verification must rely entirely on the `[]` empty state plus a hand-authored fixture `enquestes_index.json` for local testing.
   - Recommendation: Plan Phase 1's verification step to include committing one small hand-authored fixture entry (or importing Phase 2's mock output if it lands first) purely for visual/manual QA of the grid and modal — remove or keep depending on Phase 2's actual timing.

2. **Exact Node version to standardize on across contributors/CI**
   - What we know: `>=20.19.0` or `>=22.12.0` both satisfy Vite's engine floor; GitHub Actions' `setup-node` can pin any of these.
   - What's unclear: Whether the user has a preference (e.g., matching a specific LTS) beyond "whatever works."
   - Recommendation: Use Node 22 (current LTS at time of research) in both the CI workflow and local dev guidance (`.nvmrc`), since it comfortably clears the floor with room for future Vite bumps.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite 7/8 build tooling (DEPLOY-01/02, all scaffolding) | ✗ (version too old) | v20.18.3 installed; `^20.19.0 \|\| >=22.12.0` required `[VERIFIED: npm view vite@7.3.6/@8.2.2 engines, 2026-08-25]` | `nvm install 22 && nvm use 22` (or any Node ≥20.19.0) — no viable "keep old Node" fallback, both current Vite majors share this floor |
| npm | Package installs, `npm ci` in CI | ✓ | 10.8.2 | — |
| git | Repo already initialized locally | ✓ | n/a (repo has commit history) | — |
| GitHub Actions runner (`ubuntu-latest`) | DEPLOY-01 CI pipeline | ✓ (assumed available — standard GitHub-hosted runner) | n/a | — |
| GitHub Pages "Source: GitHub Actions" repo setting | DEPLOY-01/02 | Unknown — must be manually verified/set in repo Settings → Pages | n/a | This is a one-time manual repo setting the workflow YAML cannot set for you; if left on "Deploy from a branch," the Actions-based deploy will not publish `[CITED: STACK.md Version Compatibility table]` |

**Missing dependencies with no fallback:**
- None — the Node version gap has a direct fix (upgrade), not a structural blocker.

**Missing dependencies with fallback:**
- Node.js version — fix via `nvm`/equivalent before scaffolding; treat as a Wave-0 task, not an execution-time surprise.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth in this project (PROJECT.md explicit out-of-scope) |
| V3 Session Management | No | No sessions/cookies |
| V4 Access Control | No | Fully public app, no access tiers |
| V5 Input Validation | Yes | Treat `enquestes_index.json`/`[id]_meta.json` as untrusted input at the fetch boundary: guard with `Array.isArray()`/shape checks before rendering (shown in the `HomePage.tsx` example above) rather than trusting the JSON blindly; never use `dangerouslySetInnerHTML` on any field sourced from these files — React's default JSX text interpolation already HTML-escapes `title`/`description`/etc., which is the correct and sufficient mitigation here |
| V6 Cryptography | No | No secrets, no crypto operations in this phase |
| V14 Configuration | Yes | GitHub Actions workflow must request only the permissions it needs (`contents: read`, `pages: write`, `id-token: write` — no broader `write-all`), matching the least-privilege workflow shown in Code Examples |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed/unexpected-shape JSON crashing the render tree | Tampering (of the data file, however it got that way) / Denial of Service (client-side crash) | Runtime shape validation before render (`Array.isArray`, required-field presence check) rather than casting `fetch().json()` straight to a typed value with no guard |
| Reflected content injection via survey `description`/`title` text | Tampering / (limited) Information Disclosure | Never route these fields through `dangerouslySetInnerHTML`; plain JSX text nodes auto-escape, which is the entire mitigation needed at this trust level (data is author-generated via Phase 2's Python script, not end-user-submitted at runtime) |
| Overly broad GitHub Actions workflow permissions (`permissions: write-all` or omitted `permissions:` block defaulting to broad access) | Elevation of Privilege | Explicit minimal `permissions:` block (`contents: read`, `pages: write`, `id-token: write`) as shown in the workflow YAML — never rely on the repo-wide default |

## Sources

### Primary (HIGH confidence)
- `npm view <package> version / engines / peerDependencies / dependencies` — direct npm registry queries run this session for: react, react-dom, vite (incl. `@7.3.6` and `@8.2.2` engines), typescript (incl. dist-tags), tailwindcss, `@tailwindcss/vite`, react-router-dom (incl. dist-tags, dependencies), react-router, lucide-react (dist-tags), `@vitejs/plugin-react` (incl. peerDependencies/peerDependenciesMeta for `5.2.0` and `6.1.0`), eslint, typescript-eslint (incl. peerDependencies), `@duckdb/duckdb-wasm`, `@kanaries/graphic-walker` (peerDependencies, informational only — Phase 3 scope), apache-arrow — 2026-08-25
- `gsd_run query package-legitimacy check` — legitimacy verdicts for all 11 Phase-1-relevant packages — 2026-08-25
- Raw fetch of `raw.githubusercontent.com/vitejs/vite/main/packages/create-vite/template-react-ts/package.json` — confirms exact template-pinned versions (vite `^8.2.2`, typescript `~6.0.2`, `@vitejs/plugin-react` `^6.1.0`) — 2026-08-25
- `api.github.com/repos/actions/{checkout,setup-node,configure-pages,upload-pages-artifact,deploy-pages}/releases/latest` — confirms current major version tags (`v7`, `v7`, `v6`, `v5`, `v5` respectively) — 2026-08-25

### Secondary (MEDIUM confidence)
- [tailwindcss.com/docs/dark-mode](https://tailwindcss.com/docs/dark-mode) — official Tailwind v4 dark-mode/`@custom-variant` syntax
- [reactrouter.com/api/declarative-routers/BrowserRouter](https://reactrouter.com/api/declarative-routers/BrowserRouter) — official `BrowserRouter`/`basename` API signature
- [vite.dev/guide/static-deploy](https://vite.dev/guide/static-deploy) — official Vite GitHub Pages deploy guidance, `base` config
- [github.com/rafgraph/spa-github-pages](https://github.com/rafgraph/spa-github-pages) — canonical 404.html/index.html SPA redirect pattern
- `.planning/research/STACK.md`, `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` — general-project research from earlier in this session; version numbers therein are superseded by this phase's fresh `npm view` checks, but architecture/pattern-level guidance is corroborated and reused

### Tertiary (LOW confidence)
- `lucide-react` as the correct package name — carried from STACK.md/training knowledge, not independently confirmed via an official-doc fetch this session (see Assumptions Log A1 and the Package Legitimacy Audit disposition)

## Metadata

**Confidence breakdown:**
- Standard stack (versions): HIGH — every version number cross-checked against the live npm registry and, for the core scaffold packages, against the official `create-vite` template source this session
- Architecture / deploy pattern: HIGH — GitHub's native Pages deploy flow and the `spa-github-pages` redirect pattern are both long-standing, officially documented, and independently corroborated by `.planning/research/ARCHITECTURE.md`/`PITFALLS.md`
- Resolved discretion decisions (modal vs route, empty state): MEDIUM — reasoned recommendations consistent with existing project research and requirements, but not independently re-confirmed with the user after being delegated in CONTEXT.md (see Assumptions Log A2/A3)
- Pitfalls: HIGH for the Node/TypeScript version pitfalls (directly verified against this machine and the npm registry this session); MEDIUM for the base-path/404.html pitfalls (well-documented pattern, not newly verified against a live deploy in this session)

**Research date:** 2026-08-25
**Valid until:** ~14 days for exact package versions (fast-moving ecosystem — re-run `npm view` before executing if this research is consumed later); ~90 days for the architecture/deploy-pattern guidance
