# Phase 2: Offline Data Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 2-Offline Data Pipeline
**Areas discussed:** Format de dades real d'entrada

---

## Format de dades real d'entrada

**Q: Com és l'estructura dels teus exports CSV/Excel reals?**

| Option | Description | Selected |
|--------|-------------|----------|
| Una fila per resposta | Cada fila = un respondent, cada columna = una pregunta (format estàndard Google Forms/Typeform) | ✓ |
| Format diferent / múltiples fulls | Excel amb diversos fulls o resums ja agregats en comptes d'una taula plana | |

**Q: Els camps de text obert (respostes lliures, comentaris) què han de fer al pipeline?**

| Option | Description | Selected |
|--------|-------------|----------|
| Exclusió total | Mai entren al parquet ni al meta.json — s'eliminen abans de generar cap artefacte | ✓ |
| Inclusió amb revisió | S'inclouen al parquet però la checklist de privacitat els marca per revisar | |

**Q: Com se sap si una columna és una dimensió (categoria) o una mesura (numèrica)?**

| Option | Description | Selected |
|--------|-------------|----------|
| Inferit automàticament | L'script detecta el tipus per les dades: numèric → measure, text/poques categories → dimension | ✓ |
| Anotat manualment | Configuració petita on l'usuari marca cada columna abans de convertir | |

**Q: Tens un únic format d'exportació o diverses eines diferents?**

| Option | Description | Selected |
|--------|-------------|----------|
| Un sol format | L'script només ha de gestionar el format que ja té l'usuari | ✓ |
| Diverses eines/formats | Necessita gestionar variacions (Google Forms, Typeform, Excel manual) des del principi | |

**Notes:** Totes les respostes van triar l'opció recomanada. Cap aclariment addicional.

---

## Claude's Discretion

- Comportament d'enforcement de la checklist de privacitat (DATA-03): bloquejar vs. avisar-i-permetre amb confirmació explícita
- Mecanisme de selecció de KPIs per a `[id]_meta.json` (auto-calculat vs. especificat manualment)
- Abast/realisme de `generate_mock_parquet.py`
- Llibreria per escriure Parquet, disseny de CLI, format de reporting d'errors

## Deferred Ideas

None — discussion stayed within phase scope.
