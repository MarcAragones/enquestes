---
status: diagnosed
trigger: "UAT gap G-03-4 (.planning/phases/03-interactive-explorer/03-UAT.md): 'Si copio l'enllaç, no veig la gràfica que havia fet prèviament' -- pasting a copied share link into a fresh tab does not restore the previously-built visualization (EXPL-11)."
created: 2026-08-27T00:00:00Z
updated: 2026-08-27T00:00:00Z
goal: find_root_cause_only
audit_acknowledged:
  milestone: v1.0
  at: 2026-08-29
  status: diagnosed
---

## Current Focus

hypothesis: CONFIRMED (see Resolution)
test: repro test written directly against src/lib/shareLink.ts with a realistic GraphicWalker export shape
expecting: n/a - confirmed
next_action: n/a - diagnosis complete, handing off to gap-closure plan

## Symptoms

expected: Pasting a copied share link into a fresh tab opens on the identical visualization the sharer had built (EXPL-11) - same fields on the same shelves, same mark type, same active filters.
actual: Pasting the URL into a new tab does not reproduce the chart; the explorer opens with the default/empty chart state instead.
errors: None reported by the user. No console errors mentioned; failure is silent (matches shareLink.ts's own D-07 "never throw, fail soft to undefined" design intent - which is exactly why this is invisible without direct inspection).
reproduction: Build a chart in the explorer (segment on X, satisfaccio on Y, canal on Color, a territori filter, mark switched to line/scatter), click "Copia l'enllaç", paste the resulting URL in a new tab - the chart shown does not match what was built.
started: Introduced in phase 03 plan 03 (EXPL-11 share-link feature), surfaced during Phase 3's end-of-phase UAT.

## Eliminated

- hypothesis: "CR-01's isChartLike() structural guard is now too strict and rejects real specs."
  evidence: Traced exportCode()'s actual output shape by reading node_modules/@kanaries/graphic-walker/dist/store/visualSpecStore.js (exportCode -> exportNow(x) => x.now) and dist/models/visSpecHistory.js (fillChart/emptyChart, create()). A real exported chart's `x.now` always has a top-level `visId: string` and `encodings: {...}` object - isChartLike()'s check (`typeof visId === 'string' && typeof encodings === 'object'`) passes for every real chart. Confirmed structurally sound; not the cause.
  timestamp: 2026-08-27T00:00:00Z

- hypothesis: "encode side isn't capturing the live spec (storeRef/exportCode() reads a stale or wrong store)."
  evidence: Traced node_modules/@kanaries/graphic-walker/dist/store/index.js's VizStoreWrapper - store is memoized on `storeKey` (stable, since `keepAlive` isn't passed by this project, storeKey stays '' across re-renders) and `ref.current = store` is set via a plain useEffect keyed on [props.storeRef, store] - storeRef.current always points at the live, current VizSpecStore instance. exportCode() reads `this.visList.map(x => exportNow(x))` synchronously off that live store - no staleness. Not the cause.
  timestamp: 2026-08-27T00:00:00Z

- hypothesis: "decoded value isn't reaching GraphicWalker's chart prop correctly (memoization/remount/wrong prop)."
  evidence: Traced node_modules/@kanaries/graphic-walker/dist/App.js line 46/70-74 - VizApp destructures `chart` from props and runs `useEffect(() => { if (chart) vizStore.importCode(chart) }, [chart, vizStore])`. ExplorerPage.tsx passes `chart={decodedChart}` where `decodedChart` is a useMemo gated on [rawChartParam, dataState] - stable reference once dataState reaches 'success', GraphicWalker mounts for the first time already with a resolved (non-undefined) `chart` value on that same render (the Loading/loading branches render before GraphicWalker exists at all). The prop wiring and mount timing are correct. Not the cause.
  timestamp: 2026-08-27T00:00:00Z

## Evidence

- timestamp: 2026-08-27T00:00:00Z
  checked: node_modules/@kanaries/graphic-walker/dist/models/visSpecHistory.js `newChart(fields, ...)` (the function that builds every chart's initial `encodings`, invoked internally whenever GraphicWalker constructs/imports a chart)
  found: >
    `encodings.dimensions` and `encodings.measures` are built from ALL of the dataset's dimension/measure fields (the full field catalogue, not just fields dragged onto a shelf), concatenated with `extraDimensions`/`extraMeasures` derived from `createCountField()` and `createVirtualFields()` (dist/utils/index.js) - unconditionally, whenever `fields.length > 0` (i.e. whenever the dataset has any fields at all, which every real survey does).
  implication: Every real chart spec produced by this app - even a "minimal" one - always embeds GraphicWalker's own internal virtual/computed field ids inside `encodings.dimensions`/`encodings.measures`, not just the fields the user actually placed on X/Y/Color/Filter.

- timestamp: 2026-08-27T00:00:00Z
  checked: node_modules/@kanaries/graphic-walker/dist/constants.js and dist/utils/index.js (createCountField/createVirtualFields bodies)
  found: >
    COUNT_FIELD_ID = 'gw_count_fid' (added to `measures`), MEA_KEY_ID = 'gw_mea_key_fid' (added to `dimensions`), MEA_VAL_ID = 'gw_mea_val_fid' (added to `measures`) - three fixed, GraphicWalker-internal field ids present in the `encodings.dimensions`/`encodings.measures` arrays of literally every exported chart from this installed version (0.5.2).
  implication: These three fids are never part of any survey's `meta.json` field list (they don't come from the data), so they can never be present in `knownFieldNames` (built in ExplorerPage.tsx as `dataState.data.meta.fields?.map(f => f.name)`).

- timestamp: 2026-08-27T00:00:00Z
  checked: src/lib/shareLink.ts `decodeShareLink` step 6 (the T-03-11 schema-drift guard) and its helper `collectFieldReferences`
  found: >
    `collectFieldReferences` recursively walks the ENTIRE parsed JSON structure and collects every string value found at any `fid` key, anywhere in the object graph - this necessarily includes `encodings.dimensions[]`/`encodings.measures[]` entries, not just shelved-field entries. Step 6 then rejects the whole decode (`return undefined`) if ANY collected fid is absent from `knownFieldNames`.
  implication: Because `gw_count_fid`/`gw_mea_key_fid`/`gw_mea_val_fid` are always present (per the two findings above) and never in `knownFieldNames`, this check is guaranteed to fail for every real, valid, user-built chart - not just hostile/stale/cross-survey links. This is a total, unconditional false-positive rejection, not an edge case.

- timestamp: 2026-08-27T00:00:00Z
  checked: src/lib/shareLink.test.ts `makeSpec()` fixture used by all 16 existing unit tests, including the "round-trips a representative spec losslessly" test
  found: >
    `makeSpec()` is a hand-authored object that includes ONLY the four fields actually placed on shelves (segment, satisfaccio, canal, territori) in `encodings.dimensions`/`measures`/`color`/`filters` - it does not include the full dataset field catalogue nor GraphicWalker's `gw_count_fid`/`gw_mea_key_fid`/`gw_mea_val_fid` virtual fields that the real `VizSpecStore.exportCode()` always emits.
  implication: This is why the existing test suite is green (16/16 pass) despite the bug being present in production - the fixture models an idealized/incomplete chart shape rather than the shape GraphicWalker's own `newChart()`/`exportCode()` actually produces at runtime. The tests never exercised the failure condition.

- timestamp: 2026-08-27T00:00:00Z
  checked: "Direct repro: a throwaway vitest file (src/lib/__scratch_repro.test.ts, written then deleted - not committed) constructing a chart spec shaped exactly like a real GraphicWalker export (full dimensions/measures list including gw_count_fid/gw_mea_key_fid/gw_mea_val_fid, plus the four real shelved fields), round-tripped through encodeShareLink -> decodeShareLink with the real KNOWN_FIELDS list from mostra-sintetica_meta.json"
  found: "`npx vitest run src/lib/__scratch_repro.test.ts` passed asserting `decoded` is `undefined` - i.e., decodeShareLink rejects this realistic, fully-valid, user-built spec."
  implication: Direct, reproducible confirmation (not inference) that the schema-drift fid check in decodeShareLink's step 6 is the mechanism causing every real share link to fail to restore.

## Resolution

root_cause: >
  `decodeShareLink`'s schema-drift field-reference validation (src/lib/shareLink.ts, step 6, added for T-03-11) recursively collects every `fid` value found anywhere in the decoded chart-spec JSON via `collectFieldReferences`, and rejects the entire decode if any collected fid is absent from `knownFieldNames` (the survey's real field names from meta.json). But GraphicWalker's own `VizSpecStore.exportCode()` (backed by `newChart()` in the installed @kanaries/graphic-walker@0.5.2, dist/models/visSpecHistory.js) always populates `encodings.dimensions`/`encodings.measures` with the FULL dataset field catalogue plus three GraphicWalker-internal virtual/computed field ids - `gw_count_fid` (Number of records), `gw_mea_key_fid` (Measure names), `gw_mea_val_fid` (Measure values) - added unconditionally by `createCountField()`/`createVirtualFields()` (dist/utils/index.js, dist/constants.js) whenever the dataset has any fields at all. These three fids are never part of any survey's meta.json and so can never appear in `knownFieldNames`. The result: the fid-reference check in decodeShareLink rejects EVERY real, valid, user-built chart spec unconditionally - not just hostile/stale/cross-survey links as intended - because it was validated against a hand-authored test fixture (shareLink.test.ts's makeSpec()) that omits the fields GraphicWalker's real export always includes, rather than against the actual runtime output shape of `VizSpecStore.exportCode()`.
fix: (not applied - goal is find_root_cause_only; deferred to gap-closure plan)
verification: (not applicable - no fix applied)
files_changed: []
