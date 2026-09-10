#!/usr/bin/env node
// Boots the local GitHub Pages preview server and proves the invariants the
// deployed site must satisfy: base URL 200, index JSON served as an array,
// an unknown deep link answered by the 404 fallback carrying the redirect
// script, and — the catalog-completeness gate added in plan 05-02 — that
// EVERY published survey in the index is served completely and distinctly
// (its own meta.json and its own Parquet, both 200 with real content).
//
// This deliberately overlaps a little with verify-explorer-assets.mjs,
// which is index-driven but checks only the FIRST entry. That is not
// duplication to collapse: verify:explorer is about DuckDB asset emission
// and base-path correctness and only needs one real dataset to prove that;
// verify:pages is about catalog completeness and must walk all of them. A
// later reader should not "simplify" one into the other.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 4173
const BASE = `http://localhost:${PORT}/enquestes/`

// Retired in plan 05-01 (scripts/retirar_enquesta.py) — must never reappear
// in a served index.
const RETIRED_SYNTHETIC_ID = 'mostra-sintetica'

async function waitForReady() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(BASE)
      if (r.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('preview server never became ready')
}

async function main() {
  const server = spawn(
    process.execPath,
    [path.join(__dirname, 'gh-pages-preview.mjs'), '--port', String(PORT)],
    { stdio: 'inherit' },
  )

  try {
    await waitForReady()

    const root = await fetch(BASE)
    if (!root.ok) throw new Error('base url not 200')
    if (!(await root.text()).includes('id="root"')) throw new Error('react root element missing')

    const data = await fetch(`${BASE}data/enquestes_index.json`)
    if (!data.ok) throw new Error('index json not served under base')
    const index = await data.json()
    if (!Array.isArray(index)) throw new Error('index json is not an array')

    const deep = await fetch(`${BASE}enquesta/demo-2024`)
    if (deep.status !== 404) {
      throw new Error(`expected github-pages 404 status for deep link, got ${deep.status}`)
    }
    if (!(await deep.text()).includes('pathSegmentsToKeep')) {
      throw new Error('404 fallback did not serve the redirect script')
    }

    // --- Catalog-completeness gate (plan 05-02, PUB-04) ---------------
    // The multi-survey condition PUB-04 is about: at least two surveys
    // published simultaneously.
    if (index.length < 2) {
      throw new Error(
        `expected at least two published surveys in enquestes_index.json, got ${index.length}`,
      )
    }

    // Retired dataset absence.
    const retiredEntry = index.find((entry) => entry.id === RETIRED_SYNTHETIC_ID)
    if (retiredEntry) {
      throw new Error(`retired synthetic survey '${RETIRED_SYNTHETIC_ID}' is still present in the index`)
    }

    // Every entry must be served completely: its own meta.json (matching id
    // and n, non-empty fields[]) and its own non-empty Parquet file.
    const fieldNameSetsById = new Map()
    for (const entry of index) {
      const { id } = entry

      const metaRes = await fetch(`${BASE}data/enquestes/${id}_meta.json`)
      if (metaRes.status !== 200) {
        throw new Error(`survey '${id}': expected 200 for _meta.json, got ${metaRes.status}`)
      }
      const meta = await metaRes.json()
      if (meta.id !== id) {
        throw new Error(`survey '${id}': _meta.json 'id' field is '${meta.id}', expected '${id}'`)
      }
      if (meta.n !== entry.n) {
        throw new Error(`survey '${id}': _meta.json 'n' is ${meta.n}, index says ${entry.n}`)
      }
      if (!Array.isArray(meta.fields) || meta.fields.length === 0) {
        throw new Error(`survey '${id}': _meta.json fields[] must be a non-empty array`)
      }
      fieldNameSetsById.set(id, new Set(meta.fields.map((f) => f.name)))

      const parquetRes = await fetch(`${BASE}data/enquestes/${id}_respostes.parquet`)
      if (parquetRes.status !== 200) {
        throw new Error(`survey '${id}': expected 200 for _respostes.parquet, got ${parquetRes.status}`)
      }
      const parquetBody = await parquetRes.arrayBuffer()
      if (parquetBody.byteLength === 0) {
        throw new Error(`survey '${id}': _respostes.parquet served with zero content-length`)
      }
    }

    // Served-layer evidence that each survey ships its own distinct
    // dictionary — not all entries can share an identical field-name set.
    const ids = index.map((entry) => entry.id)
    let allIdentical = true
    for (let i = 1; i < ids.length && allIdentical; i++) {
      const a = fieldNameSetsById.get(ids[0])
      const b = fieldNameSetsById.get(ids[i])
      allIdentical = a.size === b.size && [...a].every((name) => b.has(name))
    }
    if (allIdentical) {
      throw new Error('every published survey served an identical field-name set — expected per-survey dictionaries')
    }

    console.log(`verify:pages — all checks passed (${index.length} enquestes verificades)`)
  } finally {
    server.kill()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
