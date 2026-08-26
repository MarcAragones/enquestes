# Enquestes — Explorador Interactiu d'Enquestes

## What This Is

Un web estàtic en React (cost 0€, allotjat a GitHub Pages) per explorar de manera interactiva dades d'enquestes. Cada enquesta es distribueix com un fitxer `.parquet`, es consulta amb SQL directament al navegador via DuckDB-Wasm, i es visualitza amb un explorador tipus Tableau/Looker (`@kanaries/graphic-walker`) perquè qualsevol visitant pugui arrossegar variables i crear els seus propis gràfics sense backend.

## Core Value

Qualsevol persona pot explorar interactivament (arrossegar X/Y/Color/Mida/Filtres i crear gràfics propis) les dades d'una enquesta directament al navegador, sense servidor ni cost, i amb consultes SQL ultra ràpides sobre el fitxer Parquet corresponent.

## Requirements

### Validated

- ✓ Projecte Vite + React + TypeScript + Tailwind CSS, desplegable com a SPA estàtica — Phase 1
- ✓ Pàgina principal (`/`): llegeix `enquestes_index.json` i mostra una graella de targetes (data, descripció, nombre de participants); clicar una targeta mostra un resum ràpid des de `[id]_meta.json` (KPIs generals, amb divulgació de mostra i supressió per mostra insuficient) amb botó "Explorar dades interactives" — Phase 1
- ✓ GitHub Actions (`.github/workflows/deploy.yml`) que fa build i desplegament a GitHub Pages a cada push a `main` — Phase 1

### Active

- [ ] Servei DuckDB-Wasm (Singleton, `src/services/duckdb.ts`) que inicialitza al navegador sense bloquejar la UI i exposa un helper per consultar `.parquet`
- [ ] Pàgina d'exploració (`/enquesta/:id`): carrega `[id]_respostes.parquet` via DuckDB-Wasm i el connecta a `<GraphicWalker />` per exploració visual lliure (Phase 1 la deixa amb un estat honest "encara no disponible")
- [ ] Script Python de conversió: dades reals crues (CSV/Excel exportat) → `[id]_respostes.parquet` + `[id]_meta.json` + entrada a `enquestes_index.json`
- [ ] Script Python de mock (`generate_mock_parquet.py`) per generar un Parquet d'exemple sense dades reals

### Out of Scope

- Autenticació / control d'accés — audiència és públic general i les dades publicades són no sensibles; no cal restringir l'accés
- Backend o servidor propi — tot ha de córrer 100% al navegador (DuckDB-Wasm), mantenint el cost a 0€
- Ingesta de formats diferents de Parquet en temps d'execució — la conversió (CSV/Excel → Parquet) es fa offline amb l'script Python abans de publicar

## Context

- Projecte personal, ja hi ha dades reals d'enquestes disponibles en format CSV/Excel exportat (ex. Google Forms/Typeform) llestes per convertir
- Audiència: públic general (qualsevol amb el link hi pot accedir i explorar)
- Nom del repositori GitHub: `enquestes` — determina el `base` path de Vite/GitHub Pages (`usuari.github.io/enquestes/`)
- Les dades que es publiquin han de ser no sensibles (sense camps identificatius com noms o emails), ja que `public/data/` és totalment públic i descarregable

## Constraints

- **Cost**: $0 — tot ha de funcionar dins el pla gratuït de GitHub Pages, sense backend ni serveis de pagament
- **Stack obligatori**: React + Vite + TypeScript + Tailwind CSS
- **Motor de dades**: `@duckdb/duckdb-wasm` executant SQL sobre `.parquet` directament al navegador
- **Explorador visual**: `@kanaries/graphic-walker`
- **Privacitat**: només dades no sensibles/anonimitzades es publiquen a `public/data/` (repo i hosting públics)
- **Desplegament**: GitHub Pages via GitHub Actions, repo `enquestes`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Només dades no sensibles a `public/data/` | GitHub Pages exposa aquesta carpeta públicament a qualsevol | ✓ Complert a Phase 1 — `public/data/` només conté l'índex buit; cap dada real desplegada encara |
| Script de conversió CSV/Excel→Parquet real inclòs al v1 | L'usuari ja té dades reals llestes per convertir ara mateix | Pendent — Phase 2 |
| Repo fixat com `enquestes` | Necessari per configurar correctament el `base` path de Vite a GitHub Pages | ✓ Complert a Phase 1 — repo `MarcAragones/enquestes`, `base: '/enquestes/'` |
| Routing: BrowserRouter + parell de redirecció `404.html`/`index.html` (`rafgraph/spa-github-pages`), en comptes de `HashRouter` | URLs netes compatibles amb els futurs enllaços compartibles de gràfic (EXPL-11); GitHub Pages no pot fer redirecció al servidor | ✓ Decidit i implementat a Phase 1 (checkpoint de decisió, plan 01-01) |
| Llindar de supressió de KPI: `MIN_KPI_SAMPLE = 10` | Una mitjana o recompte calculat sobre pocs respondents és un vector de reidentificació en un dataset públic | ✓ Implementat a Phase 1 (plan 01-03) |
| `lucide-react` per a icones, en comptes de SVG inline | Paquet oficial (`lucide-icons`), ~97M descàrregues setmanals, aprovat en checkpoint `blocking-human` | ✓ Aprovat i instal·lat a Phase 1 (plan 01-02, v1.34.0) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-26 after Phase 1*
