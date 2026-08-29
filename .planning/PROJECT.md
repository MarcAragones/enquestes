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
- ✓ Script Python de conversió (`scripts/convert_enquesta.py`): dades reals crues (CSV/TSV/Excel exportat) → `[id]_respostes.parquet` + `[id]_meta.json` + entrada a `enquestes_index.json`, amb checklist de privacitat block-by-default (quasi-identificadors per nom, k-anonimitat per grup petit, ràtio d'unicitat) i exclusió incondicional de text lliure — Phase 2, validat contra l'export real de l'usuari (2000 files × 320 columnes)
- ✓ Script Python de mock (`scripts/generate_mock_parquet.py`) que genera un Parquet d'exemple sense dades reals, reutilitzant els mateixos mòduls d'inferència/validació que la conversió real — Phase 2
- ✓ Primer dataset real publicat a `public/data/` (`mostra-sintetica`, sintètic i etiquetat com a tal) — Phase 2
- ✓ Servei DuckDB-Wasm (Singleton, `src/services/duckdb.ts`) que inicialitza al navegador sense bloquejar la UI i exposa un helper per consultar `.parquet` — Phase 3
- ✓ Pàgina d'exploració (`/enquesta/:id`): carrega `[id]_respostes.parquet` via DuckDB-Wasm i el connecta a `<GraphicWalker />` per exploració visual lliure amb drag-and-drop X/Y/Color/Mida/Filtres, diccionari de dades, exportació d'imatge i enllaç compartible de gràfic — Phase 3

### Active

*Cap requeriment actiu — totes les fases del milestone actual estan completades.*

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
| Script de conversió CSV/Excel→Parquet real inclòs al v1 | L'usuari ja té dades reals llestes per convertir ara mateix | ✓ Complert a Phase 2 — validat contra l'export real de l'usuari |
| Repo fixat com `enquestes` | Necessari per configurar correctament el `base` path de Vite a GitHub Pages | ✓ Complert a Phase 1 — repo `MarcAragones/enquestes`, `base: '/enquestes/'` |
| Routing: BrowserRouter + parell de redirecció `404.html`/`index.html` (`rafgraph/spa-github-pages`), en comptes de `HashRouter` | URLs netes compatibles amb els futurs enllaços compartibles de gràfic (EXPL-11); GitHub Pages no pot fer redirecció al servidor | ✓ Decidit i implementat a Phase 1 (checkpoint de decisió, plan 01-01) |
| Llindar de supressió de KPI: `MIN_KPI_SAMPLE = 10` | Una mitjana o recompte calculat sobre pocs respondents és un vector de reidentificació en un dataset públic | ✓ Implementat a Phase 1 (plan 01-03) |
| `lucide-react` per a icones, en comptes de SVG inline | Paquet oficial (`lucide-icons`), ~97M descàrregues setmanals, aprovat en checkpoint `blocking-human` | ✓ Aprovat i instal·lat a Phase 1 (plan 01-02, v1.34.0) |
| `uv` + PEP 723 (metadata inline al script) com a únic toolchain Python, invocat sempre via `uv run scripts/<nom>.py` | El `python3` per defecte del sistema és 3.6.10 i no pot instal·lar pandas/pyarrow; PEP 723 evita venv/requirements.txt separats | ✓ Implementat a Phase 2 (plan 02-01) |
| Llindars de privacitat: `MIN_GROUP_SIZE = 5`, `UNIQUENESS_RATIO_THRESHOLD = 0.9` (`scripts/pipeline/privacy.py`) | Valors raonables per defecte, no derivats de l'export real fins que n'hi hagués un disponible (RESEARCH A1/A2) | ✓ Validats a Phase 2 UAT contra l'export real de l'usuari sense feedback negatiu — es mantenen sense canvis |
| Detecció automàtica del delimitador CSV (`,` vs `;`) a `load_table`, amb avís visible quan s'usa `;` | L'export real de l'usuari usava `;` (convenció d'exportació de fulls de càlcul en locale espanyol/català), cosa que trencava el parser fixat en `,` | ✓ Afegit a Phase 2 arran d'un bug real trobat en UAT (gap G-02-3), amb 4 tests de regressió |
| D-02 (exclusió de columnes de text lliure) és un valor per defecte permanent, sense flag per reactivar-lo | Publicar text lliure de respondents és el vector de reidentificació més obvi; cap configuració hauria de poder-lo desactivar per accident | ✓ Implementat a Phase 2 (plan 02-01), verificat sense excepcions a cap plan posterior |
| Assets DuckDB-Wasm autoallotjats via imports `?url` de Vite (bundle `eh` de fil únic, sense CDN de tercers) | GitHub Pages no pot configurar les capçaleres COOP/COEP que calen per al bundle multifil; l'autoallotjament evita aquesta dependència per complet | ✓ Implementat a Phase 3 (plan 03-01), verificat sense referències CDN a `src/` |
| Estat de gràfic compartible via `?chart=` amb una seqüència de decodificació defensiva que mai llança excepció (límit de mida → tag de versió → base64url/UTF-8 → JSON → validació de camps contra el catàleg de la pròpia enquesta) | Un enllaç compartit és entrada totalment controlada pel visitant/atacant; calia una defensa en profunditat sense servidor per validar-lo | ✓ Implementat a Phase 3 (plans 03-03/03-05/03-06), verificat amb 19 tests i auditoria de seguretat (T-03-10/11/12, CR-01) |
| Cicle de vida del `<dialog>` natiu del modal resum encapsulat a `openDialogLifecycle` amb un comptador de supressió propietat del cridant | React StrictMode dispara un muntatge/desmuntatge/remuntatge simulat que fa que l'esdeveniment `close` natiu (assíncron) del cicle anterior arribi al nou listener i tanqui el modal real — calien dos intents (G-03-2, G-03-5) per trobar l'arrel del problema | ✓ Implementat a Phase 3 (plan 03-07), amb tests directes per als 3 timings de despatx de l'esdeveniment |
| Restaurar `margin: auto` a la capa `utilities` de Tailwind (no `base`) per centrar un `<dialog>` natiu | Tailwind v4 Preflight declara `margin: 0` d'origen "author" a `@layer base`, que sempre guanya la regla `margin: auto` d'origen "user-agent" del navegador independentment de l'especificitat — només una regla d'origen "author" a `utilities` (declarada després de `base`) ho pot vèncer | ✓ Implementat a Phase 3 (plan 03-08, gap G-03-7), verificat contra el CSS de producció compilat |
| Risc acceptat: l'id de l'enquesta de la URL es reflecteix a la capçalera de pàgina fins i tot quan l'enquesta no existeix (`ExplorerHeader`'s `<h1 title={id}>`) | Necessari perquè la capçalera es mantingui visible en tots els estats (EXPL-07); sense XSS (React escapa el valor) i l'id és una entrada coneguda per l'atacant, no un secret | ✓ Acceptat a Phase 3 durant `/gsd-verify-work` (auditoria de seguretat, AR-03-10), documentat a `03-SECURITY.md` |

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
*Last updated: 2026-08-29 after Phase 3*
