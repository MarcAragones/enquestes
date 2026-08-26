# Phase 2: Offline Data Pipeline - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 6 (2 new Python scripts, 4 new `scripts/pipeline/*.py` shared modules — module boundaries per RESEARCH.md's recommended structure)
**Analogs found:** 0 exact Python analogs / 6 — this is the project's first Python code. All "analogs" below are cross-language shape contracts (TypeScript types + JSON fixtures) or loose structural analogs (existing Node.js CLI scripts) that inform conventions, not copy-paste code.

## Important Context

This phase introduces the **first Python code in the repository**. `src/` is 100% TypeScript/React; `scripts/` currently holds only two Node.js (`.mjs`) CLI utilities. There is no existing Python file, no existing `pyproject.toml`, no existing Parquet-writing code, and no existing privacy-checklist logic anywhere in this codebase to copy from.

Because of this, pattern mapping here serves a different purpose than usual: instead of "copy this function," it is "match this **shape contract**" (for JSON/Parquet output) and "follow this **stylistic convention**" (for CLI ergonomics, established by the two Node scripts). Treat RESEARCH.md's own Code Examples (KPI computation, index upsert, uniqueness flags) as the primary source of *implementation* patterns — this document's job is to point at what output must structurally match and what conventions should carry over from the existing Node scripts.

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|-----------------|----------------|
| `scripts/convert_enquesta.py` | CLI script / batch transform | file-I/O (CSV/Excel → Parquet + JSON), event-driven (privacy gate) | `scripts/gh-pages-preview.mjs` (CLI arg parsing only) + `src/types/enquesta.ts` + `scripts/fixtures/*` (output shape contract) | shape-contract-match (no code analog) |
| `scripts/generate_mock_parquet.py` | CLI script / synthetic data generator | file-I/O (stdlib → Parquet + JSON) | Same as above; also shares steps 5-8 conceptually with `convert_enquesta.py` itself | shape-contract-match (no code analog) |
| `scripts/pipeline/schema.py` | model (dataclass/TypedDict definitions) | transform | `src/types/enquesta.ts` | **exact shape contract** — must mirror field names/optionality byte-for-byte |
| `scripts/pipeline/infer.py` | utility (pure function) | transform | none in codebase; rule is fully specified in CONTEXT.md D-03 / RESEARCH.md Pattern 3 | no analog — spec-driven |
| `scripts/pipeline/privacy.py` | utility / validation | transform, event-driven (block/allow) | `src/lib/enquestes.ts`'s `MIN_KPI_SAMPLE` + trust-boundary posture (conceptual precedent only, not code shape) | precedent-match (no code analog) |
| `scripts/pipeline/index.py` | utility (upsert) | CRUD (JSON file as mini-datastore) | none — `scripts/fixtures/enquestes_index.json` shows the exact data shape being upserted | shape-contract-match (no code analog) |

## Pattern Assignments

### `scripts/convert_enquesta.py` and `scripts/generate_mock_parquet.py` (CLI scripts)

**No Python analog exists in this codebase.** Follow RESEARCH.md's own verified patterns directly (PEP 723 inline metadata, `uv run` invocation, `argparse`). Two things *can* be carried over from the existing Node CLI scripts for consistency of developer experience across the repo's tooling:

**CLI arg parsing convention** — `scripts/gh-pages-preview.mjs` lines 9-21 (`parseArgs`):
```javascript
function parseArgs(argv) {
  const args = { dir: 'dist', base: '/enquestes/', port: 4173, fixtures: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dir') args.dir = argv[++i]
    else if (arg === '--base') args.base = argv[++i]
    else if (arg === '--port') args.port = Number(argv[++i])
    else if (arg === '--fixtures') args.fixtures = argv[++i]
  }
  ...
  return args
}
```
This establishes the repo's existing convention: **plain `--flag value` CLI args with explicit defaults, no external arg-parsing dependency.** For Python, the direct equivalent (and what RESEARCH.md already recommends) is stdlib `argparse` — do not reach for `click`/`typer`; matches the "near-zero dependency" ethos already present in the Node scripts and mandated by PROJECT.md's $0/no-backend posture.

**Path-safety convention** — `scripts/gh-pages-preview.mjs` lines 39-46 (`resolveSafe`):
```javascript
function resolveSafe(root, relPath) {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, `.${relPath}`)
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    return null
  }
  return resolved
}
```
This is the repo's existing precedent for **never trusting a path-shaped input to compose a filesystem path without validation** — directly analogous to RESEARCH.md's Security Domain note that `convert_enquesta.py`/`generate_mock_parquet.py` must validate `--id` against the same `^[A-Za-z0-9._-]{1,64}$` pattern as `isValidEnquestaId` (see below) before using it in any output path (e.g. `public/data/enquestes/<id>_meta.json`). Same defensive posture, reimplemented in Python since it's a separate process/language — do not skip this validation just because the CLI is developer-only and local.

**Zero-dependency-by-default posture** — both existing Node scripts (`gh-pages-preview.mjs`, `verify-pages.mjs`) use only Node built-ins (`node:http`, `node:fs/promises`, `node:child_process`), no npm dependencies. This mirrors RESEARCH.md's own recommendation to keep `generate_mock_parquet.py` stdlib-only beyond pandas/pyarrow (no `Faker`) — the codebase's existing scripts already establish "reach for the platform/stdlib before adding a library" as house style.

---

### `scripts/pipeline/schema.py` (model)

**Analog:** `src/types/enquesta.ts` (exact structural contract — read in full above)

This is the **one place in this phase where "closest analog" means "must match exactly," not "similar."** `schema.py`'s dataclasses/TypedDicts must reproduce every field name and optionality marker from `src/types/enquesta.ts` verbatim:

```typescript
// src/types/enquesta.ts:1-31 — the exact target shape
export interface EnquestaIndexEntry {
  id: string
  title: string
  date: string
  description: string
  n: number
}

export interface EnquestaMetaKpi {
  label: string
  value: number | string
  unit?: string
  n?: number
}

export interface EnquestaMetaField {
  name: string
  label?: string
  description?: string
  type: 'dimension' | 'measure'
}

export interface EnquestaMeta {
  id: string
  title: string
  date: string
  description: string
  n: number
  kpis: EnquestaMetaKpi[]
  fields?: EnquestaMetaField[]
}
```

Key parity points to enforce in `schema.py`:
- `EnquestaMetaKpi.value` is `number | string` — the Python schema/serialization must permit both (e.g. `round(float(mean), 2)` for numeric KPIs), matching `parseEnquestaMeta`'s runtime check (`src/lib/enquestes.ts:119`: `typeof value !== 'string' && !(typeof value === 'number' && Number.isFinite(value))`).
- `unit` and `n` on `EnquestaMetaKpi`, and `label`/`description` on `EnquestaMetaField`, and `fields` on `EnquestaMeta` are all **optional** — when absent, the Python script must omit the key entirely from the written JSON (not write `null`), because the TS validators only check `typeof x !== 'string'` when the key is present but never require presence. Confirm via `src/lib/enquestes.ts:122` (`if (unit !== undefined && typeof unit !== 'string')`) and `:128` (`if (fields !== undefined) { ... }`).
- `EnquestaMetaField.type` is a closed union `'dimension' | 'measure'` — `infer.py`'s output must only ever produce one of these two literal strings (validated at `src/lib/enquestes.ts:142`: `if (type !== 'dimension' && type !== 'measure') throw ...`).

**Golden-file fixtures to validate output shape against** — `scripts/fixtures/enquestes_index.json` (full file, 30 lines) and `scripts/fixtures/enquestes/demo-2024_meta.json` (full file, 31 lines), both read in full above. Notable details the Python output should match:
- `id` values use `kebab-case` ASCII (`satisfaccio-clients-2026`, `demo-2024`) — consistent with `isValidEnquestaId`'s regex.
- `date` fields are plain ISO date strings (`"2026-03-14"`, no time component) — matches `formatDate`'s UTC-midnight parsing assumption at `src/lib/enquestes.ts:73-74`.
- Catalan accented characters are written as literal UTF-8 (`"Satisfacció de clients 2026"`), never `\uXXXX` escapes — confirms RESEARCH.md's `ensure_ascii=False` requirement for `json.dumps`/`Path.write_text`.
- `demo-2024_meta.json`'s three KPIs deliberately exercise: a KPI with no own `n` (inherits the survey-level `n`), a KPI with a smaller own `n` than the survey (180 < 250), and a KPI with `n` below `MIN_KPI_SAMPLE=10` (n=6) — this is the "below-suppression-threshold" edge case CONTEXT.md flags; the mock generator should be able to produce an equivalent case via its `--n`/edge-case flags per RESEARCH.md Open Question 2.
- `enquestes_index.json`'s `enquesta-pilot-buida` entry (`n: 0`, no matching Parquet/meta files in fixtures) is a JSON-only edge case with no backing artifacts — the real pipeline's output, by contrast, must always produce all three matching artifacts (index entry + meta.json + parquet) for any id it processes.

---

### `scripts/pipeline/infer.py` (utility)

**No analog — fully spec-driven.** CONTEXT.md D-03 and RESEARCH.md Pattern 3 give the literal implementation already; there is nothing in the existing codebase (TS or otherwise) that performs numeric-vs-categorical column classification. Implement exactly as RESEARCH.md specifies (numeric-coercion check → `measure`, else `dimension`), with no cardinality-based reclassification per the Anti-Patterns note in RESEARCH.md.

---

### `scripts/pipeline/privacy.py` (utility / validation)

**Conceptual precedent (not a code analog):** `src/lib/enquestes.ts:3-4`
```typescript
/** Sample size below which a KPI value is withheld rather than published. */
export const MIN_KPI_SAMPLE = 10
```
This is the project's one existing "err toward withholding, state why" precedent — RESEARCH.md already builds on it directly (k=5 threshold, one notch below `MIN_KPI_SAMPLE`). No code pattern to copy since this constant is enforced client-side at render time, not at data-production time — `privacy.py` is a new kind of check for this codebase (pre-publish structural gate on raw rows, not display-time suppression of computed values). Implement per RESEARCH.md Pattern 2 (block-by-default gate) and Pattern 4 (uniqueness ratio + name-pattern hints + small-group k-anonymity scan) — those are already concrete, verified code examples in RESEARCH.md and should be used as-is rather than re-derived.

---

### `scripts/pipeline/index.py` (upsert utility)

**No code analog — shape contract only.** `scripts/fixtures/enquestes_index.json` (full file above) is the exact JSON shape being read/mutated/written. RESEARCH.md's own Code Examples section already provides a complete, directly-usable implementation:

```python
# RESEARCH.md "enquestes_index.json upsert" — use as-is
import json
from pathlib import Path

def upsert_index_entry(index_path: Path, new_entry: dict) -> None:
    existing = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else []
    replaced = False
    for i, entry in enumerate(existing):
        if entry["id"] == new_entry["id"]:
            existing[i] = new_entry
            replaced = True
            break
    if not replaced:
        existing.append(new_entry)
    index_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
```
`ensure_ascii=False` is required — confirmed against the fixture file's literal accented UTF-8 characters (e.g. `"Satisfacció de clients 2026"`, `"càrrega de treball"` in `clima-laboral-2026`'s description).

## Shared Patterns

### Id validation (path-safety / trust boundary)
**Source:** `src/lib/enquestes.ts:11-13`
```typescript
export function isValidEnquestaId(id: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(id)
}
```
**Apply to:** Both `convert_enquesta.py` and `generate_mock_parquet.py` — reimplement the identical regex in Python (`re.fullmatch(r'[A-Za-z0-9._-]{1,64}', id)`) and validate `--id` before it touches any output filesystem path. This guarantees any id the pipeline produces will always round-trip successfully through the app's own client-side validator, and mirrors the existing `resolveSafe` path-safety discipline already present in `scripts/gh-pages-preview.mjs`.

### Schema shape parity (JSON output contract)
**Source:** `src/types/enquesta.ts` (full file) + `src/lib/enquestes.ts`'s `parseEnquestesIndex`/`parseEnquestaMeta` (lines 38-61, 93-147)
**Apply to:** `scripts/pipeline/schema.py`, and indirectly every script that writes `_meta.json`/`enquestes_index.json`. Every field the TS validators check (required vs. optional, exact literal unions, `number | string` for KPI `value`) is a hard constraint on the Python output — there is no automated cross-language check in this phase, so treat these two TS files as the executable spec to manually diff against.

### Golden-file examples (structural QA reference)
**Source:** `scripts/fixtures/enquestes_index.json`, `scripts/fixtures/enquestes/demo-2024_meta.json`
**Apply to:** Both scripts' output, and any test/QA step added in this phase. These are the only existing examples of "a JSON file that satisfies the contract, written by a human" — useful as golden files to diff structurally against generated output (key presence/absence, UTF-8 encoding, id format, date format).

### Zero-dependency CLI ergonomics
**Source:** `scripts/gh-pages-preview.mjs` (full file), `scripts/verify-pages.mjs` (full file)
**Apply to:** Both new Python scripts' CLI argument handling and general dependency posture. Confirms the repo-wide convention (independently arrived at by RESEARCH.md for Python) of stdlib-first, explicit `--flag value` parsing, no framework/library for something this small.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/convert_enquesta.py` | CLI script | file-I/O + privacy gate | First Python file in the repo; no CSV/Excel/Parquet-reading code exists anywhere to copy. Follow RESEARCH.md's Architecture Patterns and Code Examples directly. |
| `scripts/generate_mock_parquet.py` | CLI script | file-I/O (synthetic) | Same — no existing mock-data generator of any kind (Python or TS) exists in this codebase. |
| `scripts/pipeline/infer.py` | utility | transform | Fully specified by CONTEXT.md D-03 / RESEARCH.md Pattern 3; no prior art in codebase. |
| `scripts/pipeline/privacy.py` | utility | validation/event-driven | Novel check for this codebase (pre-publish structural gate); only a conceptual precedent (`MIN_KPI_SAMPLE`) exists, not a code pattern. Use RESEARCH.md Pattern 4's code directly. |

## Metadata

**Analog search scope:** `src/` (full tree), `scripts/` (full tree), `.planning/phases/01-foundation-survey-listing/` summaries (referenced, not re-read — already covered by RESEARCH.md's canonical_refs)
**Files scanned:** `src/types/enquesta.ts`, `src/lib/enquestes.ts`, `scripts/fixtures/enquestes_index.json`, `scripts/fixtures/enquestes/demo-2024_meta.json`, `scripts/gh-pages-preview.mjs`, `scripts/verify-pages.mjs`
**Pattern extraction date:** 2026-08-26
</content>
