#!/usr/bin/env node
// Proves the exact gap STATE.md flags: `vite dev` serves the DuckDB wasm and
// worker files from node_modules and proves nothing about whether they are
// emitted, base-prefixed, and served correctly once built for GitHub Pages.
import { spawn } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 4174
const BASE = `http://localhost:${PORT}/enquestes/`
const DIST = path.join(__dirname, '..', 'dist')

const EH_WASM = /duckdb-eh-.*\.wasm$/
const MVP_WASM = /duckdb-mvp-.*\.wasm$/
const EH_WORKER = /duckdb-browser-eh\.worker-.*\.js$/
const MVP_WORKER = /duckdb-browser-mvp\.worker-.*\.js$/

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(full)))
    } else {
      files.push(full)
    }
  }
  return files
}

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
  const distStat = await stat(DIST).catch(() => null)
  if (!distStat || !distStat.isDirectory()) {
    throw new Error('dist/ does not exist — run `npm run build` first')
  }

  const allFiles = await walk(DIST)
  const relFiles = allFiles.map((f) => path.relative(DIST, f).split(path.sep).join('/'))

  const ehWasm = relFiles.find((f) => EH_WASM.test(f))
  const mvpWasm = relFiles.find((f) => MVP_WASM.test(f))
  const ehWorker = relFiles.find((f) => EH_WORKER.test(f))
  const mvpWorker = relFiles.find((f) => MVP_WORKER.test(f))

  if (!ehWasm) throw new Error('missing emitted asset: duckdb-eh-*.wasm')
  if (!mvpWasm) throw new Error('missing emitted asset: duckdb-mvp-*.wasm')
  if (!ehWorker) throw new Error('missing emitted asset: duckdb-browser-eh.worker-*.js')
  if (!mvpWorker) throw new Error('missing emitted asset: duckdb-browser-mvp.worker-*.js')

  const server = spawn(
    process.execPath,
    [
      path.join(__dirname, 'gh-pages-preview.mjs'),
      '--port',
      String(PORT),
      '--dir',
      DIST,
      '--base',
      '/enquestes/',
    ],
    { stdio: 'inherit' },
  )

  try {
    await waitForReady()

    const wasmAssets = [ehWasm, mvpWasm]
    const workerAssets = [ehWorker, mvpWorker]

    for (const asset of wasmAssets) {
      const res = await fetch(`${BASE}${asset}`)
      if (res.status !== 200) throw new Error(`expected 200 for ${asset}, got ${res.status}`)
      const body = await res.arrayBuffer()
      if (body.byteLength === 0) throw new Error(`asset ${asset} served with zero content-length`)
      const contentType = res.headers.get('content-type')
      if (contentType !== 'application/wasm') {
        throw new Error(`expected content-type application/wasm for ${asset}, got ${contentType}`)
      }
    }

    for (const asset of workerAssets) {
      const res = await fetch(`${BASE}${asset}`)
      if (res.status !== 200) throw new Error(`expected 200 for ${asset}, got ${res.status}`)
      const body = await res.arrayBuffer()
      if (body.byteLength === 0) throw new Error(`asset ${asset} served with zero content-length`)
    }

    const parquetRes = await fetch(`${BASE}data/enquestes/mostra-sintetica_respostes.parquet`)
    if (parquetRes.status !== 200) {
      throw new Error(`expected 200 for the committed Parquet, got ${parquetRes.status}`)
    }
    const parquetBody = await parquetRes.arrayBuffer()
    if (parquetBody.byteLength !== 5597) {
      throw new Error(
        `expected mostra-sintetica_respostes.parquet to be exactly 5597 bytes, got ${parquetBody.byteLength}`,
      )
    }

    const metaRes = await fetch(`${BASE}data/enquestes/mostra-sintetica_meta.json`)
    if (metaRes.status !== 200) {
      throw new Error(`expected 200 for mostra-sintetica_meta.json, got ${metaRes.status}`)
    }
    const meta = await metaRes.json()
    if (!Array.isArray(meta.fields) || meta.fields.length !== 6) {
      throw new Error(
        `expected mostra-sintetica_meta.json fields[] to have 6 entries, got ${meta.fields?.length}`,
      )
    }

    const jsChunkPaths = allFiles.filter((f) => f.endsWith('.js') && f.includes(`${path.sep}assets${path.sep}`))
    let baseReferenceCount = 0
    for (const chunkPath of jsChunkPaths) {
      const content = await readFile(chunkPath, 'utf8')
      const matches = content.match(/\/enquestes\/assets\/duckdb-[^"'`)]*/g)
      if (matches) baseReferenceCount += matches.length
    }
    if (baseReferenceCount < 2) {
      throw new Error(
        `expected at least two base-prefixed /enquestes/assets/duckdb- references in emitted JS chunks, found ${baseReferenceCount}`,
      )
    }

    console.log(
      `verify:explorer — all checks passed (4 DuckDB assets verified: ${ehWasm}, ${mvpWasm}, ${ehWorker}, ${mvpWorker})`,
    )
  } finally {
    server.kill()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
