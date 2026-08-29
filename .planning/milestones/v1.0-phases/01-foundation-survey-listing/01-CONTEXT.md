# Phase 1: Foundation & Survey Listing - Context

**Gathered:** 2026-08-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can visit the live, deployed GitHub Pages site and browse a catalog of available surveys with quick KPI previews — the Vite/React/Tailwind app shell, the GitHub Actions deploy pipeline, and the JSON-only homepage (survey card grid + per-survey KPI summary) — before any DuckDB-Wasm/GraphicWalker interactive exploration exists (that's Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Disseny visual

- **D-01:** Paleta de colors neutra/minimalista — blanc-negre-grisos amb un sol color d'accent, look tipus dashboard de dades seriós
- **D-02:** Suport per dark mode amb toggle — l'usuari pot canviar entre clar/fosc; per defecte respecta la preferència del sistema (`prefers-color-scheme`)
- **D-03:** Targetes d'enquesta només amb text (títol, data, descripció, N participants) — sense imatge, icona ni emoji, focus en la informació
- **D-04:** Estil tipogràfic modern/tech — sans-serif net, tipus eina SaaS/dashboard de dades (no editorial/càlid)

### Claude's Discretion

- **Estratègia de routing** (`BrowserRouter` + `404.html` redirect trick vs `HashRouter`) per als deep-links a `/enquesta/:id` — l'usuari va delegar aquesta decisió. Recomanació de la recerca (STACK.md): `BrowserRouter` + `404.html` per URLs netes, ja que és el patró estàndard de deploy natiu de GitHub Actions/Pages.
- **Flux del resum ràpid en clicar una targeta** (modal/panell superposat vs ruta dedicada) — l'usuari va delegar aquesta decisió.
- **Estat buit del catàleg** (què es mostra si encara no hi ha cap enquesta publicada, ja que la Fase 2 de dades pot anar en paral·lel i no estar llesta) — l'usuari va delegar aquesta decisió.
- **Idioma de la interfície** — no discutit explícitament; tot el context del projecte (PROJECT.md, converses) és en català, així que la interfície per defecte serà en català, sense necessitat de i18n per v1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Recerca de projecte (new-project research)
- `.planning/research/STACK.md` — stack prescriptiu (React 19 + Vite 7 + TS + Tailwind v4), configuració de `base` path per GitHub Pages, patró de deploy natiu (`actions/deploy-pages`), decisió de routing pendent (BrowserRouter+404.html vs HashRouter)
- `.planning/research/ARCHITECTURE.md` — separació de components (JSON-only homepage vs DuckDB-Wasm service a Explorer), ordre de construcció suggerit
- `.planning/research/PITFALLS.md` — esculls de deploy a GitHub Pages (base path, SPA routing, caching d'assets públics)
- `.planning/research/FEATURES.md` — definició detallada de A1/A2/A3 (graella, estats de càrrega/error, resum KPI) que aquesta fase implementa

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
Cap encara — aquest és el primer codi del projecte (repositori acabat d'inicialitzar).

### Established Patterns
Cap encara — aquesta fase estableix els patrons base (estructura de carpetes, convencions de components) que fases posteriors reutilitzaran.

### Integration Points
Cap encara — aquesta fase és la base sobre la qual s'integraran DuckDB-Wasm i GraphicWalker a la Fase 3.

</code_context>

<specifics>
## Specific Ideas

Cap referència específica addicional més enllà de les decisions capturades a dalt — obert a enfocaments estàndard per a la resta d'aspectes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Foundation & Survey Listing*
*Context gathered: 2026-08-25*
