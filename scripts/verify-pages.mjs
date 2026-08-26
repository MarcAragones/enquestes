#!/usr/bin/env node
// Boots the local GitHub Pages preview server and proves the same three
// invariants the deployed site must satisfy: base URL 200, index JSON
// served as an array, and an unknown deep link answered by the 404
// fallback carrying the redirect script.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 4173
const BASE = `http://localhost:${PORT}/enquestes/`

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
    if (!Array.isArray(await data.json())) throw new Error('index json is not an array')

    const deep = await fetch(`${BASE}enquesta/demo-2024`)
    if (deep.status !== 404) {
      throw new Error(`expected github-pages 404 status for deep link, got ${deep.status}`)
    }
    if (!(await deep.text()).includes('pathSegmentsToKeep')) {
      throw new Error('404 fallback did not serve the redirect script')
    }

    console.log('verify:pages — all checks passed')
  } finally {
    server.kill()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
