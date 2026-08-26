import * as duckdb from '@duckdb/duckdb-wasm'
import { dataUrl, isValidEnquestaId } from '../lib/enquestes'

// Exact filenames of the built artefacts in @duckdb/duckdb-wasm@1.32.0/dist —
// these are not part of the library's public TypeScript API, so they are not
// guessed; they are confirmed present on disk at install time (Task 2).
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import duckdb_worker_eh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import duckdb_wasm_mvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import duckdb_worker_mvp from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'

/**
 * Exactly two bundles: mvp and eh. Deliberately no `coi` (threaded) entry —
 * the threaded bundle requires COOP/COEP response headers, and GitHub Pages
 * has no mechanism to set custom response headers. Registering a coi bundle
 * here would make duckdb.selectBundle() able to pick a bundle that can never
 * instantiate in production.
 */
const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_wasm_mvp, mainWorker: duckdb_worker_mvp },
  eh: { mainModule: duckdb_wasm_eh, mainWorker: duckdb_worker_eh },
}

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null

async function initDb(): Promise<duckdb.AsyncDuckDB> {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
  const worker = new Worker(bundle.mainWorker!)
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  return db
}

/**
 * Singleton AsyncDuckDB owner. Memoises a single module-level promise so
 * React StrictMode's double-invoked effect, and any later navigation back to
 * the explorer, both reuse one engine and one Worker rather than spinning up
 * a second one.
 */
export function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) dbPromise = initDb()
  return dbPromise
}

// Guards against re-registering the same virtual filename twice (React
// StrictMode's double-invoked effect, a revisit, or a retry), which would
// otherwise throw on the second registerFileURL call for the same name.
const registeredFiles = new Set<string>()

/**
 * The only function in the codebase permitted to run read_parquet. `id`
 * re-asserts isValidEnquestaId before it can reach a virtual filename or a
 * SQL string literal — defence in depth even though callers are expected to
 * have already validated it via the route guard.
 */
export async function queryParquet(id: string): Promise<Record<string, unknown>[]> {
  if (!isValidEnquestaId(id)) {
    throw new Error('Invalid enquesta id')
  }

  const url = dataUrl(`enquestes/${encodeURIComponent(id)}_respostes.parquet`)
  const virtualName = `${id}_respostes.parquet`

  const db = await getDb()

  if (!registeredFiles.has(virtualName)) {
    await db.registerFileURL(virtualName, url, duckdb.DuckDBDataProtocol.HTTP, false)
    registeredFiles.add(virtualName)
  }

  const conn = await db.connect()
  try {
    const result = await conn.query(`SELECT * FROM read_parquet('${virtualName}')`)
    return result.toArray().map((row) => {
      const obj = row.toJSON() as Record<string, unknown>
      for (const key of Object.keys(obj)) {
        // int64 measure columns arrive as BigInt — GraphicWalker's chart
        // engine cannot consume BigInt, so convert to a plain number. Safe
        // for this dataset's value ranges (age, 1-10 score, 0-100 percent),
        // all far below Number.MAX_SAFE_INTEGER.
        if (typeof obj[key] === 'bigint') {
          obj[key] = Number(obj[key] as bigint)
        }
      }
      return obj
    })
  } finally {
    await conn.close()
  }
}
