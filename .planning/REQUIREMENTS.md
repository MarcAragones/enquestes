# Requirements: Enquestes — Explorador Interactiu d'Enquestes

**Defined:** 2026-08-25
**Core Value:** Qualsevol persona pot explorar interactivament (arrossegar X/Y/Color/Mida/Filtres i crear gràfics propis) les dades d'una enquesta directament al navegador, sense servidor ni cost.

## v1 Requirements

### Llistat (Homepage)

- [x] **HOME-01**: User pot veure una graella de targetes de totes les enquestes disponibles, amb títol, data, descripció i nombre de participants
- [x] **HOME-02**: User veu un missatge d'error clar si `enquestes_index.json` no es pot carregar (en lloc de pantalla en blanc)
- [x] **HOME-03**: User pot clicar una targeta i veure un resum ràpid de KPIs (ex. edat mitjana, satisfacció) carregat des de `[id]_meta.json`, abans d'entrar a l'explorador
- [x] **HOME-04**: User pot accedir a l'explorador complet des del resum ràpid amb un botó "Explorar dades interactives"

### Explorador

- [x] **EXPL-01**: User veu un indicador de progrés mentre DuckDB-Wasm s'inicialitza i el fitxer Parquet es descarrega/processa
- [x] **EXPL-02**: User veu un missatge d'error clar si la inicialització de DuckDB o la càrrega/consulta del Parquet falla
- [x] **EXPL-03**: User pot arrossegar variables (X, Y, Color, Mida, Filtres) per crear gràfics personalitzats amb `<GraphicWalker />`
- [x] **EXPL-04**: User pot triar entre múltiples tipus de gràfic (barres, línies, àrea, dispersió, etc.)
- [x] **EXPL-05**: Els camps es tipen correctament com a dimensió o mesura, segons el que genera el script de conversió
- [x] **EXPL-06**: La interfície de l'explorador es manté usable (no visualment trencada) en mides de pantalla petites/mitjanes
- [x] **EXPL-07**: User pot tornar al llistat d'enquestes des de l'explorador
- [x] **EXPL-08**: Un link directe a `/enquesta/:id` funciona correctament en carregar-lo o refrescar-lo (sense 404 a GitHub Pages)
- [x] **EXPL-09**: User pot veure descripcions de camps (diccionari de dades) des de `[id]_meta.json` dins l'explorador
- [ ] **EXPL-10**: User pot exportar el gràfic actual com a imatge (PNG/SVG)
- [ ] **EXPL-11**: User pot generar/copiar un link que reprodueix exactament la visualització actual (encoding de camps + filtres actius) mitjançant query params

### Dades (Pipeline offline)

- [x] **DATA-01**: Script Python converteix dades reals (CSV/Excel exportat) a `[id]_respostes.parquet` + `[id]_meta.json`, i afegeix l'entrada corresponent a `enquestes_index.json`
- [x] **DATA-02**: Script Python de mock (`generate_mock_parquet.py`) genera dades de prova sense necessitat de dades reals
- [x] **DATA-03**: El procés de conversió inclou una revisió/checklist de privacitat abans de publicar dades reals (detectar quasi-identificadors, no només noms/emails)

### Desplegament

- [x] **DEPLOY-01**: L'aplicació es desplega automàticament a GitHub Pages via GitHub Actions a cada push a `main`
- [x] **DEPLOY-02**: El build es configura amb el `base` path correcte del repositori (`enquestes`) i amb fallback SPA (404.html o HashRouter) perquè els deep-links a `/enquesta/:id` funcionin

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Descobriment

- **DISC-01**: Cerca/filtre/etiquetatge entre enquestes — rellevant quan el catàleg superi ~12-15 enquestes
- **DISC-02**: Estratègies per a datasets grans (pre-agregació, chunking de Parquet) — només si una enquesta concreta demostra ser massa gran per carregar còmodament al navegador

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Comptes d'usuari / vistes desades | Requereix backend + auth + BD, viola la restricció de $0/sense backend |
| Edició en viu/col·laborativa d'un gràfic | Requeriria servidor (WebSocket/pub-sub), impossible en GitHub Pages estàtic |
| Pujada de CSV/Excel en temps real per l'usuari | La conversió és explícitament un pas offline (script Python); ingesta en runtime obre problemes de tipatge i escala fora d'abast |
| Agregació/paginació server-side | No hi ha servidor; DuckDB-Wasm + Parquet ja gestiona el volum esperat completament al client |
| Optimització tàctil completa per a mòbil | GraphicWalker és una UI d'arrossegar-i-deixar orientada a escriptori; el llindar de v1 és "no es trenca visualment", no suport tàctil complet |
| Analítica/telemetria personalitzada de visitants | Requereix backend o script de tercers; fora d'abast i sense flux de consentiment definit |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HOME-01 | Phase 1 | Complete |
| HOME-02 | Phase 1 | Complete |
| HOME-03 | Phase 1 | Complete |
| HOME-04 | Phase 1 | Complete |
| EXPL-01 | Phase 3 | Complete |
| EXPL-02 | Phase 3 | Complete |
| EXPL-03 | Phase 3 | Complete |
| EXPL-04 | Phase 3 | Complete |
| EXPL-05 | Phase 3 | Complete |
| EXPL-06 | Phase 3 | Complete |
| EXPL-07 | Phase 3 | Complete |
| EXPL-08 | Phase 3 | Complete |
| EXPL-09 | Phase 3 | Complete |
| EXPL-10 | Phase 3 | Pending |
| EXPL-11 | Phase 3 | Pending |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| DATA-03 | Phase 2 | Complete |
| DEPLOY-01 | Phase 1 | Complete |
| DEPLOY-02 | Phase 1 | Complete |

**Coverage:**

- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-25*
*Last updated: 2026-08-25 after roadmap creation*
