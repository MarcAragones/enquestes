---
status: diagnosed
trigger: "DATA_START\nGap G-03-4b (Phase 3 UAT test 4): The GraphicWalker chart canvas fills the available space rather than rendering small. User report (Catalan, verbatim): \"El bar chart no ocupa tot l'espai. Queda reduit a una petita part. Hauria de ser mes gran.\" Reproduction: build a chart (fields on X/Y, mark type bar) in the explorer at /enquesta/mostra-sintetica in the production build — the rendered chart area is small relative to the available canvas space. Investigate (a) GraphicWalker fixed internal chart size regardless of container, (b) wrapper min-h/width classes insufficient given header+dictionary stacked above, (c) an unused GraphicWalker layout/fit-to-container prop.\nDATA_END"
created: 2026-08-27T00:00:00Z
updated: 2026-08-27T00:20:00Z
goal: find_root_cause_only
symptoms_prefilled: true
audit_acknowledged:
  milestone: v1.0
  at: 2026-08-29
  status: diagnosed
---

## Current Focus

hypothesis: CONFIRMED — see Resolution below
test: none further needed
expecting: n/a
next_action: return ROOT CAUSE FOUND to caller (no fix — goal is find_root_cause_only)

## Symptoms

expected: |
  After building a bar chart in the explorer (fields on X/Y, mark = bar), the rendered chart
  occupies the available canvas area — the full-width, viewport-sized wrapper `<div className="min-h-screen">`
  in ExplorerPage.tsx that hosts <GraphicWalker>.
actual: |
  The rendered bar chart is small — a small fraction of the available wrapper area — regardless
  of how large the surrounding container is.
errors: none reported
reproduction: |
  Production build (npm run build && npm run preview:pages), navigate to
  /enquestes/enquesta/mostra-sintetica, drag segment -> X, satisfaccio -> Y, mark = bar.
  The drawn chart is small; large empty space surrounds it inside the wrapper div.
started: Discovered during Phase 3 UAT test 4 (03-01 built the wrapper with min-h; 03-02 added header

  + collapsible data dictionary above the canvas)

## Eliminated

- hypothesis: "(b) The wrapper's min-h-screen / full-width classes are insufficient or miscalculated given the header + DataDictionary panel stacked above the canvas"
  evidence: |
    Read src/pages/ExplorerPage.tsx (lines 178-196), src/components/DataDictionary.tsx, src/components/ExplorerHeader.tsx,
    src/App.tsx. The GraphicWalker mount sits in a plain sibling `<div className="min-h-screen">` with no
    max-width constraint anywhere in its ancestor chain on the /enquesta/ route (App.tsx explicitly renders
    `<main>` with no wrapper classes on this route, confirmed by reading App.tsx lines 12-24). DataDictionary
    is a `<details>` element above it that does not constrain the sibling's width. There is no CSS width
    restriction reaching the GraphicWalker mount point. Yet the symptom is specifically that the *drawn chart
    canvas itself* is small (a ~272x152px net Vega-Lite plot area, per Evidence below) while the surrounding
    wrapper div correctly spans full width/height — proving the DOM wrapper sizing is NOT the constraint.
  timestamp: 2026-08-27T00:15:00Z

- hypothesis: "(a) GraphicWalker always renders its internal chart-drawing area at a fixed/default size regardless of container, with no way to make it fill the container"
  evidence: |
    Read node_modules/@kanaries/graphic-walker/dist/renderer/specRenderer.js and
    node_modules/@kanaries/graphic-walker/dist/vis/react-vega.js directly. GraphicWalker DOES support a
    container-filling render path (layout.size.mode === 'full', using useResizeDetector() to read the
    actual DOM container's width/height and pass those into the Vega-Lite spec, and sizing the outer
    Resizable wrapper to 100%/100%). So "always fixed, no way to fill container" is false as a blanket
    claim — the capability exists, it is just not selected. This narrows to hypothesis (c).
  timestamp: 2026-08-27T00:16:00Z

## Evidence

- timestamp: 2026-08-27T00:05:00Z
  checked: node_modules/@kanaries/graphic-walker/dist/interfaces.d.ts (IVisualLayout, IDefaultConfig, IVizStoreProps)
  found: |
    `IVisualLayout.size` is `{ mode: 'auto' | 'fixed' | 'full'; width: number; height: number }`.
    `IVizStoreProps.defaultConfig?: IDefaultConfig` where `IDefaultConfig.layout?: Partial<IVisualLayout>`.
    This is a documented, typed prop on `<GraphicWalker>` (it composes IVizStoreProps) specifically for
    overriding the chart's default layout/size behavior, including a `'full'` (fit-to-container) mode.
  implication: GraphicWalker exposes exactly the "fit to container" config hypothesis (c) predicted.

- timestamp: 2026-08-27T00:08:00Z
  checked: node_modules/@kanaries/graphic-walker/dist/utils/save.js (emptyVisualLayout, the default layout used whenever the host app does not supply defaultConfig.layout)
  found: |
    `emptyVisualLayout.size = { mode: 'auto', width: 320, height: 200 }` — confirmed by direct read of the
    literal object (also corroborated by node_modules/@kanaries/graphic-walker/dist/models/normalize.test.js
    fixtures asserting the same `{ mode: 'auto', width: 320, height: 200 }` shape).
  implication: |
    Every new chart GraphicWalker creates (via store/visualSpecStore.js's `fromFields`/`newChart`/`emptyChart` in
    models/visSpecHistory.js) starts with `layout.size.mode === 'auto'` UNLESS the host passes
    `defaultConfig.layout.size` to override it. `src/pages/ExplorerPage.tsx`'s `<GraphicWalker>` call
    (lines 186-192) passes only `dataSource`, `rawFields`, `appearance`, `storeRef`, `chart` — no
    `defaultConfig` prop at all. So every chart the user builds from scratch in this app starts in 'auto' mode.

- timestamp: 2026-08-27T00:11:00Z
  checked: node_modules/@kanaries/graphic-walker/dist/renderer/specRenderer.js lines 74-112
  found: |
    The outer `<Resizable>` wrapper's `size` prop is set by a three-way branch on `size.mode`:
    `'fixed'` -> `{width: size.width+'px', height: size.height+'px'}`;
    `'full'` -> `{width: '100%', height: '100%'}`;
    otherwise ('auto', the default) -> `{width: 'auto', height: 'auto'}` (shrink-to-content, NOT stretched
    to the parent). The chart renderer itself (`ReactVega`) is always given
    `width: size.width - 12*4` / `height: size.height - 12*4` (i.e. 320-48=272 / 200-48=152 pixels for the
    'auto' default) as literal props, independent of the actual rendered container size.
  implication: |
    In 'auto' mode the whole GraphicWalker canvas — both its outer wrapper and the pixel dimensions handed
    to the chart renderer — is decoupled from the surrounding DOM container size. The project's
    `min-h-screen` wrapper div around `<GraphicWalker>` (ExplorerPage.tsx line 184) has no effect on this,
    because GraphicWalker's own internal layout system does not consult its container's size at all
    in 'auto' mode.

- timestamp: 2026-08-27T00:13:00Z
  checked: node_modules/@kanaries/graphic-walker/dist/vis/react-vega.js lines 135-153
  found: |
    `getSize()`: if `layoutMode === 'auto'`, returns `{ width: 0, height: 0 }` (Vega-Lite is told to compute
    its own natural/default footprint, e.g. bar-chart step-based sizing — typically small). If
    `layoutMode === 'full'` AND `areaWidth`/`areaHeight` (from `useResizeDetector()`, which measures the
    actual rendered DOM container) are truthy, returns `{ width: areaWidth, height: areaHeight }` — i.e.
    only 'full' mode measures and fills the real container. Otherwise (fixed mode) returns the literal
    `width`/`height` props (320-48/200-48 from the default config).
  implication: |
    'full' mode is the only one of the three that ties the Vega-Lite chart's rendered size to the actual
    DOM container. 'auto' (the unconfigured default) explicitly does NOT do this — confirming the exact
    mechanism producing the reported small-chart symptom.

- timestamp: 2026-08-27T00:14:00Z
  checked: node_modules/@kanaries/graphic-walker/dist/models/visSpecHistory.js lines 443-451 (emptyChart), and store/visualSpecStore.js lines 50-58, 292-301
  found: |
    `emptyChart(visId, name, defaultConfig)` builds `layout: defaultConfig?.layout ? {...emptyVisualLayout, ...defaultConfig.layout} : emptyVisualLayout`.
    `VisualSpecStore`'s constructor and `addChart`/`replaceChart`-style methods (`this.visList = [fromFields(this.meta, name, this.defaultConfig)]`)
    always route through this same `defaultConfig` merge. `this.defaultConfig` comes straight from the
    `defaultConfig` prop passed to `<GraphicWalker>` (see store/index.js lines 22-56, which calls
    `store.setDefaultConfig(props.defaultConfig)`).
  implication: |
    There is no other code path that could set `layout.size.mode` to something other than 'auto' for a
    chart the user builds in this app — it is deterministically 'auto' for every newly-created chart tab
    because `defaultConfig` is never passed from `ExplorerPage.tsx`.

- timestamp: 2026-08-27T00:15:30Z
  checked: src/pages/ExplorerPage.tsx lines 178-196 (the <GraphicWalker> mount and its wrapper)
  found: |
    `<div className="min-h-screen"><ChartErrorBoundary key={...}><GraphicWalker dataSource={rows}
    rawFields={toGraphicWalkerFields(meta.fields ?? [])} appearance={theme} storeRef={vizStoreRef}
    chart={decodedChart} /></ChartErrorBoundary></div>`. No `defaultConfig` prop. No `defaultRenderer` prop.
  implication: Confirms the project never overrides GraphicWalker's default 'auto' size mode.

## Resolution

root_cause: |
  GraphicWalker's own internal chart-layout system defaults every newly-created chart to
  `layout.size.mode === 'auto'` (GraphicWalker's `emptyVisualLayout` default: `{ mode: 'auto', width: 320,
  height: 200 }`, in node_modules/@kanaries/graphic-walker/dist/utils/save.js). In 'auto' mode, GraphicWalker's
  renderer (dist/renderer/specRenderer.js + dist/vis/react-vega.js) deliberately does NOT measure or fill its
  DOM container: the outer wrapper is sized 'auto'/'auto' (shrink-to-content) and the Vega-Lite chart itself
  is told to compute its own natural footprint (width/height passed as 0, which Vega-Lite resolves to a
  small step-based size for a categorical bar chart). Only `layout.size.mode === 'full'` makes GraphicWalker
  measure the actual rendered container (via `useResizeDetector()`) and stretch the chart to fill it.
  `src/pages/ExplorerPage.tsx`'s `<GraphicWalker>` mount (lines 186-192) never passes GraphicWalker's
  documented `defaultConfig` prop (`IVizStoreProps.defaultConfig.layout.size.mode`), so every chart the
  visitor builds from scratch is created in the unconfigured 'auto' mode — small and fully decoupled from
  the size of the project's own `min-h-screen` canvas wrapper. This is hypothesis (c) from the debug request,
  confirmed directly against the installed library's source (not a hypothesis about the project's own CSS —
  the project's wrapper sizing is correct and was ruled out directly).
fix: (not applied — goal is find_root_cause_only; a separate gap-closure plan implements the fix)
verification: (not applicable in this mode)
files_changed: []
