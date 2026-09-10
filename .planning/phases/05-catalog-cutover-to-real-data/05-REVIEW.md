---
phase: 05-catalog-cutover-to-real-data
reviewed: 2026-09-10T07:27:18Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - scripts/retirar_enquesta.py
  - scripts/pipeline/index.py
  - scripts/pipeline_selftest.py
  - scripts/verify-explorer-assets.mjs
  - scripts/generate_mock_parquet.py
  - scripts/README.md
  - public/data/enquestes_index.json
  - src/lib/realSurveys.test.ts
  - src/pages/ExplorerPage.tsx
  - src/lib/shareLink.test.ts
  - scripts/verify-pages.mjs
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-09-10T07:27:18Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase retires the synthetic demo survey and cuts the catalog over to
three real published surveys, adding `retirar_enquesta.py`,
`pipeline.index.compute_index_without_id`, and two Node-based verification
scripts (`verify-pages.mjs`, `verify-explorer-assets.mjs`) that gate
publication. The core containment/atomicity discipline in the retire path
(resolve-and-validate paths → compute → schema-validate → atomic write →
only then unlink) is sound and well-tested by `pipeline_selftest.py`
(`ComputeIndexWithoutIdTests`, `RetirarEnquestaTests`). No security
vulnerabilities, injection paths, or data-corrupting logic errors were
found in the reviewed files.

The issues found are all robustness/consistency gaps rather than active
defects in the happy path: two spots where a malformed/failing filesystem
or JSON operation escalates to a raw unhandled crash instead of the
friendly error path the rest of the module follows; a genuine mismatch
between `scripts/README.md`'s documented exit-code contract and what
`pipeline_selftest.py` itself proves the CLI actually returns; a missing
`useMemo` on a GraphicWalker prop in `ExplorerPage.tsx` that is
inconsistent with the deliberate memoization applied one prop over for
the identical reason; and a missing `spawn` error handler shared by both
verification scripts.

## Warnings

### WR-01: Unhandled JSON parse error crashes with a raw traceback instead of a SchemaError

**File:** `scripts/pipeline/index.py:25` and `scripts/pipeline/index.py:55`
**Issue:** Both `compute_upserted_index` and `compute_index_without_id` call
`json.loads(index_path.read_text(...))` with no `try`/`except` around the
parse itself. Every other rejection path in these two functions
(not-a-list, entries-not-dicts, missing file, no-matching-id) raises
`schema.SchemaError`, which `retirar_enquesta.py` and
`generate_mock_parquet.py` both specifically catch and turn into a
friendly `ERROR: ...` message on stderr with a clean `return 1`. A
corrupted/truncated/hand-edited `enquestes_index.json` (invalid JSON) is
the one malformed-input case that instead raises `json.JSONDecodeError`,
which is not a `schema.SchemaError` and therefore propagates uncaught out
of `main()` as a raw Python traceback — inconsistent with every sibling
failure mode this module was clearly designed to handle gracefully.
**Fix:**
```python
try:
    existing = json.loads(index_path.read_text(encoding="utf-8"))
except json.JSONDecodeError as exc:
    raise schema.SchemaError(f"'{index_path}' no és JSON vàlid: {exc}") from exc
```
Apply the same wrapping in both `compute_upserted_index` and
`compute_index_without_id`.

### WR-02: Artifact unlink loop is not defensive against OSError

**File:** `scripts/retirar_enquesta.py:112-118`
**Issue:** The final loop that unlinks `parquet_path` and `meta_path` calls
`path.unlink()` with no `try`/`except`. If the first unlink succeeds but
the second raises (e.g. `PermissionError`, a locked file on a shared
filesystem), the exception propagates uncaught: the operator gets a raw
traceback instead of the script's own `OK: ...`/`ERROR: ...` reporting
convention, and the "fitxers eliminats" summary line is never printed even
though one file was in fact removed. The core invariant documented in the
module docstring (index write happens before any unlink, so an
interruption here can only leave an orphan file) still holds, but the
failure is surfaced far more abruptly than every other error path in this
same script.
**Fix:**
```python
removed = []
errors = []
for path in (parquet_path, meta_path):
    if not path.exists():
        print(f"AVÍS: '{path}' ja no existia", file=sys.stderr)
        continue
    try:
        path.unlink()
        removed.append(str(path))
    except OSError as exc:
        errors.append(f"{path}: {exc}")

if errors:
    print("ERROR: no s'han pogut eliminar tots els fitxers:", file=sys.stderr)
    for err in errors:
        print(f"  {err}", file=sys.stderr)
    return 1
```

### WR-03: Documented exit-code contract for `convert_enquesta.py` collides with argparse's own exit code

**File:** `scripts/README.md:50-56` and `scripts/pipeline_selftest.py:438-457`
**Issue:** `scripts/README.md`'s "Codis de sortida" table states exit code
`1` means "Error d'ús o d'entrada (CSV il·legible, `--id` invàlid, columna
no trobada)" and exit code `2` means exclusively "El checklist de
privacitat ha trobat indicis i no s'ha passat `--confirm-privacy-review`".
But `pipeline_selftest.py`'s own regression test
`test_invalid_date_value_is_rejected_before_any_work`
(`EndToEndConversionTests`, WR-05 regression) asserts that an invalid
`--date` value — which is squarely a "usage/input error" per the README's
own code-1 bucket, and lists a sibling case (`--id invàlid`) explicitly —
in fact exits with code `2` (`self.assertEqual(ctx.exception.code, 2)`),
almost certainly because argparse's own `type=`/`parser.error()` machinery
defaults to `sys.exit(2)` on validation failure, independent of the app's
own explicit code-2 return path for the privacy gate. Any external
tooling or operator relying on the documented contract to distinguish
"needs a human to review privacy findings" (2) from "fix your CLI
arguments" (1) will misclassify a malformed `--date` as a privacy block.
**Fix:** Either make the `--date` validator raise a plain `ValueError`
handled by the script's own code and returned as exit code `1` (matching
the documented usage-error bucket and every other input-validation
failure), or update `scripts/README.md`'s exit-code table to explicitly
carve out argparse-level validation failures as a third, distinct code-2
cause so the documented contract matches observed behavior.

## Info

### IN-01: GraphicWalker `rawFields` prop is rebuilt on every render, unlike the sibling `chart` prop

**File:** `src/pages/ExplorerPage.tsx:271`
**Issue:** `rawFields={toGraphicWalkerFields(meta.fields ?? [])}` constructs
a brand-new array on every render of `ExplorerPage`. A few lines above,
`decodedChart` (passed as the `chart` prop on the very same
`<GraphicWalker>`, line 274) is deliberately wrapped in `useMemo`, with an
extensive comment explaining exactly this class of risk: "a fresh object
reference on every render would make GraphicWalker treat the `chart` prop
as having changed and remount the canvas mid-session." The same reasoning
applies to `rawFields`, which the file does not memoize. `ExplorerPage`
re-renders for reasons unrelated to the survey's field list — theme
toggling via `useTheme()`, `engineAttempt`/`dataAttempt` state changes,
etc. — so a visitor mid-way through building a chart risks GraphicWalker
treating the field catalogue as having changed on every such re-render.
Actual impact depends on GraphicWalker's internal prop-identity handling
(not verified here), which is why this is filed as Info rather than a
confirmed defect, but the inconsistency with the file's own documented
memoization rationale for the adjacent prop is worth closing.
**Fix:**
```tsx
const rawFields = useMemo(
  () => toGraphicWalkerFields(meta.fields ?? []),
  [meta.fields],
)
// ...
<GraphicWalker rawFields={rawFields} ... />
```

### IN-02: `spawn()` result has no `error` listener in either verification script

**File:** `scripts/verify-explorer-assets.mjs:66-78`, `scripts/verify-pages.mjs:41-45`
**Issue:** Both scripts call `spawn(process.execPath, [...])` and store the
result in `server`, but neither registers `server.on('error', ...)`. Per
Node's `EventEmitter` contract, if the child process fails to spawn at
all (missing `gh-pages-preview.mjs`, invalid exec path, permission
denial), Node emits an `'error'` event with no listener attached, which
crashes the whole verifier process with an unhandled-exception stack
trace rather than the scripts' own clear `main().catch(err => ...)`
reporting path — and bypasses the `try/finally` that would otherwise call
`server.kill()`. Both scripts also duplicate an identical `waitForReady()`
helper verbatim (`verify-explorer-assets.mjs:34-45`,
`verify-pages.mjs:27-38`), which could be shared from `gh-pages-preview.mjs`
or a small shared helper module.
**Fix:**
```js
const server = spawn(process.execPath, [...], { stdio: 'inherit' })
server.on('error', (err) => {
  console.error(`failed to start preview server: ${err.message}`)
  process.exitCode = 1
})
```

---

_Reviewed: 2026-09-10T07:27:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
