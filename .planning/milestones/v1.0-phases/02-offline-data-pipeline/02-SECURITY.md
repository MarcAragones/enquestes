---
phase: 02
slug: offline-data-pipeline
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-26
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Raw export file → `convert_enquesta.py` / `load_table` | An untrusted-shaped spreadsheet (arbitrary headers, cell content, encoding, sheet structure) crosses into the pipeline | Full raw respondent-level export |
| `convert_enquesta.py` / `generate_mock_parquet.py` → `public/data/` | Everything crossing here becomes permanent, public git history and is served to every site visitor | Published Parquet + JSON artifacts |
| CLI argument (`--id`, `--out-dir`) → filesystem path | `--id` and `--out-dir` compose output paths | Survey id string, output directory path |
| Privacy checklist findings → the developer's judgement | The report is the only thing standing between a quasi-identifier and permanent public git history | Column names + column-level statistics only, never respondent-level cell values |
| CLI namespace → privacy gate decision | The acknowledgement flag is the sole satisfier of the DATA-03 gate | `--confirm-privacy-review` boolean |
| Pipeline JSON output → app trust boundary | `parseEnquestesIndex` / `parseEnquestaMeta` reject malformed shapes at read time; this pipeline is the producer side | `enquestes_index.json`, `<id>_meta.json` |
| `uv`-resolved PyPI installs → local pipeline execution | Third-party code (`pandas`, `pyarrow`, `openpyxl`) enters the pipeline and processes raw respondent data | Package code only, no network calls at runtime |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Information Disclosure | `convert_enquesta.py` publish step | high | mitigate | Block-by-default privacy checklist: `run_privacy_checklist` runs before any write, the report always prints, non-empty findings exit 2 unless `--confirm-privacy-review` is passed on that invocation. Verified: `mostra-tracer.csv` near-unique-id case and `mostra-privacitat.csv` case both confirmed exit 2 with nothing written (02-01-SUMMARY D2, 02-02-SUMMARY D1). | closed |
| T-02-02 | Tampering | `--id` / `--out-dir` path composition | medium | mitigate | `is_valid_enquesta_id` (`^[A-Za-z0-9._-]{1,64}$`) rejects the id before any path is composed; output paths resolved inside `--out-dir`. Re-verified in current code (`scripts/convert_enquesta.py:101`) after the G-02-2 UAT fix that made `--id` optional for `--list-columns` mode — the validation gate itself is unchanged, only its unconditional-vs-conditional invocation moved. | closed |
| T-02-03 | Tampering | `pipeline/index.py` upsert | medium | mitigate | Match-by-id replace-or-append over the loaded array, never a rebuild; proven both by manual two-id conversion and a dedicated self-test (02-01-SUMMARY D4). Function later renamed `compute_upserted_index` (pure) with explicit `validate_index` + `write_json` call sequence added by CR-02 code-review fix — behavior unchanged, write-ordering hardened. | closed |
| T-02-04 | Information Disclosure | column allow-list / free-text drop | high | mitigate | `--columns` is a required allow-list (nothing enters by default); `is_free_text_column` drops open-ended columns unconditionally with no override flag (D-02). Verified against the tracer fixture's `comentari_lliure` column (02-01-SUMMARY D3). | closed |
| T-02-05 | Tampering | JSON written into `public/data/` | low | mitigate | `validate_meta` / `validate_index` run in-process before write; cell content is only ever read as data, never `eval`/`exec`'d. Re-verified in current code (`scripts/convert_enquesta.py:220-232`): validate-then-write ordering confirmed intact after the CR-02 fix. | closed |
| T-02-06 | Tampering | raw `.xlsx` opened by the developer in a spreadsheet app | low | accept | Formula injection is a risk of the developer's own spreadsheet app, not of this script; pandas reads cell values as data and never evaluates formulas. Accepted: the file is already on the developer's machine before the pipeline sees it. | closed |
| T-02-07 | Information Disclosure | `privacy.name_hint_flags` coverage | high | mitigate | Name hints cover Catalan and English spellings of classic re-identification quasi-identifiers (postal code, birth date, age band, gender, municipality, department, job title), accent/case-normalized matching. Verified: `codi_postal` flagged despite low uniqueness ratio (02-02-SUMMARY D1). | closed |
| T-02-08 | Information Disclosure | `privacy.small_group_flags` | high | mitigate | Every 2- and 3-column dimension combination is grouped; any group below `MIN_GROUP_SIZE` (5) is flagged. Verified against `mostra-privacitat.csv`'s `departament`×`franja_edat` 2-row group (02-02-SUMMARY D2). | closed |
| T-02-09 | Repudiation | checklist report honesty | medium | mitigate | Unevaluated columns are reported as unevaluated, never folded into a clean result; report always states the assessed-column count. Verified (02-02-SUMMARY D3). | closed |
| T-02-10 | Elevation of Privilege | privacy gate satisfaction | high | mitigate | Acknowledgement read only from the parsed CLI namespace on that invocation — no env var, config default or state file can pre-satisfy it. Verified: `CONFIRM_PRIVACY_REVIEW=1` in environment with flag omitted still exits 2 (02-02-SUMMARY D4). Re-confirmed in current code (`scripts/convert_enquesta.py:182`, no `os.environ` reference anywhere in the file). | closed |
| T-02-11 | Tampering | `load_table` encoding / delimiter fallback | low | mitigate | `cp1252` fallback and (added by the G-02-3 UAT fix) `;`-vs-`,` delimiter sniffing are never silent — both append a visible warning telling the developer to spot-check the result. Re-verified in current code (`scripts/pipeline/load.py`: `_detect_csv_delimiter`, encoding-fallback warning append). | closed |
| T-02-12 | Spoofing | generated survey presented to visitors | medium | mitigate | Generated title/description state on their face that the responses are synthetic and randomly generated ("dades sintètiques", "no corresponen a cap persona real"). Verified present in committed `mostra-sintetica_meta.json`. | closed |
| T-02-13 | Tampering | `generate_mock_parquet.py` `--id` path composition | medium | mitigate | `schema.is_valid_enquesta_id` rejects anything outside the id pattern before a path is composed. Re-verified in current code (`scripts/generate_mock_parquet.py:95`). | closed |
| T-02-14 | Tampering | `enquestes_index.json` overwrite | medium | mitigate | `upsert_index_entry` (now `compute_upserted_index`) replaces only the matching id and preserves siblings; committed index cross-checked against committed meta after the run. | closed |
| T-02-15 | Information Disclosure | mock generator reading real data | low | mitigate | Generator takes no input file path and imports no reader; every value comes from a seeded `random.Random`, so no code path can leak real respondent data into its output. | closed |
| T-02-16 | Tampering | malformed JSON committed to `public/data/` | low | mitigate | `schema.validate_meta` / `validate_index` run in-process before write, artifacts read back and cross-checked after write. Re-verified in current code (`scripts/generate_mock_parquet.py:144-152`). | closed |
| T-02-SC | Tampering (supply chain) | `uv`-resolved `pandas`, `pyarrow`, `openpyxl` installs across all three plans | high | mitigate | RESEARCH.md `## Package Legitimacy Audit` cleared all three against the live PyPI JSON API with repository evidence (`pandas-dev/pandas`, `apache/arrow`, openpyxl on foss.heptapod.net); `Faker` deliberately not added to the mock generator. No package outside the audited set was added by any of the three plans. `uv run`'s PEP 723 inline metadata pins dependencies per-script; no unpinned transitive installs. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-02-06 | Formula-injection risk in a raw `.xlsx` lives in the developer's own spreadsheet application when they open the source file, not in this script — pandas' `.xlsx` reader (`openpyxl`) reads cell values as data and never evaluates formulas. The file is already present on the developer's machine before the pipeline touches it. | Plan authors (02-01/02-02), confirmed at Phase 2 UAT | 2026-08-26 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-26 | 17 | 17 | 0 | Claude (orchestrator, `/gsd-secure-phase 02`) — L1/ASVS-1 classification directly from the three plans' plan-time `<threat_model>` registers, cross-checked against all three `SUMMARY.md` coverage sections (all `status: pass`) and re-verified by grep against current code for the six mitigations touched by post-execution UAT/code-review fixes (T-02-02, T-02-05, T-02-10, T-02-11, T-02-13, T-02-16 — all confirmed intact). Per protocol, `threats_open: 0 AND register_authored_at_plan_time: true AND asvs_level == 1` short-circuits to L1 grep-depth classification without a separate auditor dispatch. |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-26
