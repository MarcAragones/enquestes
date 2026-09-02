---
phase: 04
slug: real-survey-conversion-publication
status: verified
threats_open: 0
asvs_level: 1
created: 2026-09-02
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| operator's real export file → `load_table` | Third-party survey tool output; untrusted as to shape, not as attacker-supplied | Real respondent rows, unvalidated structure |
| real respondent data → scratch directory → `public/data/` | Deliberate stop at scratch dir; crossing into `public/data/` is permanent and public | Real respondent-derived columns, post-filter |
| privacy checklist report → operator decision → `--confirm-privacy-review` / `--skip-privacy-review` | Gate deciding what becomes permanently public | Column-level statistics only (never cell values) |
| reproduction files for regression tests → `scripts/fixtures/` → public git history | A regression test built from a real export would commit real respondent data | Synthetic data only, by construction |
| approved artifacts → `public/data/` → public git history → GitHub Pages | The permanence boundary; this phase is the moment real respondent data crosses it | Published Parquet + meta + index entries |
| `enquestes_index.json` → React app → every visitor | Only source the homepage reads to decide which surveys exist | Survey metadata (id, title, date, description, n) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Information Disclosure | cardinality filter's interaction with existing exclusion gates | high | mitigate | D-02 free-text drop runs before D-01 cardinality; `--include-columns` cannot resurrect a free-text column; privacy checklist keeps post-filter position | closed |
| T-04-02 | Information Disclosure | `format_high_cardinality_report` / console output pasted into SUMMARY files | medium | mitigate | Reports names + integer counts only; CR-01/CR-02 code-review fixes removed all remaining raw-cell-value printing surfaces (`head`/`tail`/`mostres=`) from production scripts | closed |
| T-04-03 | Tampering | `--include-columns` argument values | low | mitigate | Unknown/duplicate names rejected at exit 1 before any drop; never composes a filesystem path | closed |
| T-04-04 | Elevation of Privilege | `--out-dir` path composition in `_resolve_output_paths` | low | accept | Pre-existing resolve-and-contain guard untouched this phase | closed |
| T-04-05 | Information Disclosure | conversion runs before privacy approval | high | mitigate | *Verified in operator-authorized deviated form* — `--skip-privacy-review` defaults `False`, never inferred, requires explicit per-invocation opt-in; git history confirms only one commit ever wrote to `public/data/` (the approved 04-03 publication) | closed |
| T-04-06 | Information Disclosure | regression fixtures built from a real export | high | mitigate | `scripts/fixtures/` untouched since pre-phase; all new fixtures built inline from synthetic data | closed |
| T-04-07 | Repudiation | privacy findings resolved without a record | medium | mitigate | *Verified in deviated form* — explicit skip decision recorded verbatim with source URL in 04-02-SUMMARY.md; flag always prints a named skip message; README corrected (CR-03) | closed |
| T-04-08 | Tampering | malformed real export corrupting output artifacts | medium | mitigate | Ragged rows raise actionable `ValueError`; no realign/repair path; post-write read-back gate intact | closed |
| T-04-09 | Tampering | PUB-05 fix silently weakening a v1.0 detection rule | medium | mitigate | All three named v1.0 regression tests present and passing after WR-03 sniffer rewrite; full suite 71/71 | closed |
| T-04-10 | Information Disclosure | publishing a survey whose privacy findings were never resolved | high | mitigate | *Verified in deviated form* — same evidence as T-04-07, plus full traceability chain through 04-03-SUMMARY.md including operator's explicit "yes" to proceed | closed |
| T-04-11 | Information Disclosure | publishing a column set different from the one reviewed | high | mitigate | Published `meta.fields` counts (283/291/263) match 04-02's recorded surviving-column counts exactly; zero overlap between published fields and 04-02's recorded drop lists | closed |
| T-04-12 | Tampering | index upsert losing or duplicating a sibling entry | medium | mitigate | `mostra-sintetica` entry byte-identical to pre-phase baseline; zero duplicate ids; `VerifyPublicacioTests` 9/9 pass | closed |
| T-04-13 | Information Disclosure | publication verifier's report leaking respondent data | low | mitigate | Reads only Parquet metadata (`num_rows`, schema names); no row-content read path exists in `verify_publicacio.py` | closed |
| T-04-14 | Tampering | hand-edited index/meta bypassing validate-before-write gates | medium | mitigate | Every published artifact byte-identical to `schema.write_json`'s canonical output; atomic writes (WR-06); WR-01 clean-error handling added | closed |
| T-04-15 | Elevation of Privilege | `--data-dir` path composition in verifier | low | accept | Verifier confirmed read-only — no write/mkdir/replace call in `verify_publicacio.py` | closed |
| T-04-SC | Tampering | package-manager installs | n/a | accept | No `package.json`/`package-lock.json` changes this phase; PEP 723 headers unchanged | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Registration gap (non-blocking):** `--skip-privacy-review` (introduced mid-phase in 04-02, commit `15a012d`, as a Rule 4 scope extension) has no threat ID of its own in any plan's register — it is covered only indirectly by T-04-05/07/10. Its implementation was independently verified sound (default `False`, per-invocation explicit opt-in, never inferred, always announced, documented, regression-tested). Recommend minting an explicit threat ID for it if this flag is exercised again in a future phase.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-04-01 | T-04-04 | `--out-dir` path composition guard pre-dates this phase and is untouched; no new surface introduced | Phase 2 (carried forward) | 2026-09-02 |
| AR-04-02 | T-04-15 | `verify_publicacio.py` is read-only by construction; `--data-dir` cannot cause a write outside the tree | gsd-security-auditor (verified) | 2026-09-02 |
| AR-04-03 | T-04-SC | No package-manager changes this phase | gsd-security-auditor (verified) | 2026-09-02 |
| AR-04-04 | T-04-05, T-04-07, T-04-10 (deviated mitigation) | REO1167/REO1151/REO1145 were published without running `privacy.run_privacy_checklist`. Operator explicitly decided to skip it (source: Centre d'Estudis d'Opinió, official government-published pre-anonymized microdata, https://web.gencat.cat/ca/generalitat/dades-indicadors/centre-estudis-opinio). Quantified by the auditor: running only the (cheap) name-hint heuristic against the *published column names* — no data read — surfaces 7 / 30 / 6 `quasi-identifier-name` matches respectively across REO1167/REO1151/REO1145 (e.g. `EDAT_CEO`, `EDAT_GR`, `SEXE`, `GENERE`, `ENQUESTADOR_SEXE`, 22 `ANY_NAIXEMENT_FILL_*` columns in REO1151). The small-group k-anonymity scan (the expensive combinatorial check whose ~3h runtime motivated the skip) was never run for any of the three surveys, so no k-anonymity finding exists for 2,000–6,706 respondents across 263–291 published dimension columns. Data under `public/data/` is permanently public via git history once pushed. | marcaragones (operator, verbatim decision recorded in 04-02-SUMMARY.md) | 2026-08-30 |
| AR-04-05 | (procedural, not threat-mapped) | `--out-dir` defaults to `public/data` — nothing in code prevents a future pre-approval run from omitting `--out-dir` and writing directly into the repo. Held for this phase (verified via git history: exactly one commit touched `public/data/`, the approved publication), but is a procedural discipline, not a code-enforced one. | gsd-security-auditor (flagged as residual, not a code defect) | 2026-09-02 |
| AR-04-06 | (procedural, not threat-mapped) | `low_memory=False` (the wide-export dtype-inference fix) is the one `load.py` change this phase that emits no warning, a documented departure from the module's otherwise-universal detect-warn idiom. Accepted as removing a silent ambiguity (mixed int/str dtype) rather than introducing one. | gsd-security-auditor (verified) | 2026-09-02 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-02 | 16 | 16 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-02
