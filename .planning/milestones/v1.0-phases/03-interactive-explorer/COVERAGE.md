# API Coverage — Phase 3 (Interactive Explorer)

No external API integration: this phase wires two client-side npm libraries (`@duckdb/duckdb-wasm`, `@kanaries/graphic-walker`) against static files already committed to `public/data/` — there is no service, no network API surface, no credentials, and no backend of any kind (project-level $0/no-backend constraint). The deterministic detector run at plan time returned `detected: false` with zero signals over the Phase 3 scope; this declaration exists so the seal-time re-scan (which also reads PLAN.md prose such as "wire DuckDB-Wasm into GraphicWalker") does not raise a false positive.

The only remote reads this phase performs are `fetch`/HTTP-range GETs of the site's own static assets served by GitHub Pages (`<id>_meta.json`, `<id>_respostes.parquet`, and the self-hosted DuckDB `.wasm`/worker bundles) — asset retrieval, not API integration.
