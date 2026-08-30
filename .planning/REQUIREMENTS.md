# Requirements: Enquestes — Explorador Interactiu d'Enquestes

**Defined:** 2026-08-30
**Core Value:** Qualsevol persona pot explorar interactivament (arrossegar X/Y/Color/Mida/Filtres i crear gràfics propis) les dades d'una enquesta directament al navegador, sense servidor ni cost.

## v1.1 Requirements

Requirements for the "Publish Real Survey Data" milestone. Each maps to roadmap phases.

### Publicació de dades reals

- [ ] **PUB-01**: Cada una de les 2-5 enquestes reals de l'usuari es converteix correctament (CSV/Excel → `[id]_respostes.parquet` + `[id]_meta.json`) i passa la revisió de privacitat abans de publicar-se
- [ ] **PUB-02**: Totes les enquestes reals aprovades es publiquen a `public/data/` i apareixen amb la seva entrada corresponent a `enquestes_index.json`
- [ ] **PUB-03**: El dataset sintètic (`mostra-sintetica`) es retira del catàleg un cop les enquestes reals estan publicades
- [ ] **PUB-04**: El catàleg (homepage) i l'explorador funcionen correctament quan hi ha múltiples enquestes reals simultànies (no només una)
- [ ] **PUB-05**: Qualsevol incompatibilitat del pipeline amb el format/estructura de les exportacions reals (delimitadors, tipus de columna, mides, encoding) es detecta i es corregeix sense trencar el comportament ja validat a v1.0

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
| Optimització tàctil completa per a mòbil | GraphicWalker és una UI d'arrossegar-i-deixar orientada a escriptori; el llindar és "no es trenca visualment", no suport tàctil complet |
| Analítica/telemetria personalitzada de visitants | Requereix backend o script de tercers; fora d'abast i sense flux de consentiment definit |
| Cerca/filtre de catàleg (DISC-01) aquest milestone | Només 2-5 enquestes reals previstes; per sota del llindar (~12-15) on la cerca aporta valor |
| Estratègies per a datasets grans (DISC-02) aquest milestone | Sense evidència que cap de les exportacions reals actuals sigui massa gran per al navegador |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PUB-01 | Phase 4 | Pending |
| PUB-02 | Phase 4 | Pending |
| PUB-03 | Phase 5 | Pending |
| PUB-04 | Phase 5 | Pending |
| PUB-05 | Phase 4 | Pending |

**Coverage:**

- v1.1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0 ✓

**Per phase:**

- Phase 4 — Real Survey Conversion & Publication: PUB-01, PUB-02, PUB-05
- Phase 5 — Catalog Cutover to Real Data: PUB-03, PUB-04

---
*Requirements defined: 2026-08-30*
*Last updated: 2026-08-30 after v1.1 roadmap creation (traceability mapped)*
