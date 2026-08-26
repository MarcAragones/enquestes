#!/usr/bin/env node
// Zero-dependency static server reproducing GitHub Pages 404.html fallback
// semantics, because `vite preview` does not serve 404.html for unknown
// paths and therefore cannot prove the deep-link fallback locally.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

function parseArgs(argv) {
  const args = { dir: 'dist', base: '/enquestes/', port: 4173, fixtures: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dir') args.dir = argv[++i]
    else if (arg === '--base') args.base = argv[++i]
    else if (arg === '--port') args.port = Number(argv[++i])
    else if (arg === '--fixtures') args.fixtures = argv[++i]
  }
  if (!args.base.startsWith('/')) args.base = `/${args.base}`
  if (!args.base.endsWith('/')) args.base = `${args.base}/`
  return args
}

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.parquet': 'application/octet-stream',
}

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream'
}

/** Resolves `relPath` against `root`, refusing any path that escapes it. */
function resolveSafe(root, relPath) {
  const resolvedRoot = path.resolve(root)
  const resolved = path.resolve(resolvedRoot, `.${relPath}`)
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    return null
  }
  return resolved
}

async function fileExists(filePath) {
  try {
    const s = await stat(filePath)
    return s.isFile()
  } catch {
    return false
  }
}

export function createHandler({ dir, base, fixtures }) {
  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost')
    const pathname = decodeURIComponent(url.pathname)

    if (pathname === '/') {
      res.writeHead(302, { Location: base })
      res.end()
      return
    }

    if (!pathname.startsWith(base)) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const underBase = pathname.slice(base.length - 1) // keep leading '/'
    const dataPrefix = '/data/'

    if (fixtures && underBase.startsWith(dataPrefix)) {
      const fixturePath = resolveSafe(fixtures, underBase.slice(dataPrefix.length - 1))
      if (fixturePath === null) {
        res.writeHead(400)
        res.end('Bad request')
        return
      }
      if (await fileExists(fixturePath)) {
        const body = await readFile(fixturePath)
        res.writeHead(200, { 'Content-Type': contentTypeFor(fixturePath) })
        res.end(body)
        return
      }
      // Fall through to --dir below.
    }

    const resolved = resolveSafe(dir, underBase === '/' ? '/index.html' : underBase)
    if (resolved === null) {
      res.writeHead(400)
      res.end('Bad request')
      return
    }

    if (await fileExists(resolved)) {
      const body = await readFile(resolved)
      res.writeHead(200, { 'Content-Type': contentTypeFor(resolved) })
      res.end(body)
      return
    }

    const notFoundPath = path.resolve(dir, '404.html')
    if (await fileExists(notFoundPath)) {
      const body = await readFile(notFoundPath)
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(body)
      return
    }

    res.writeHead(404)
    res.end('Not found')
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const server = createServer(createHandler(args))
  server.listen(args.port, () => {
    console.log(`ready — serving ${args.dir} at http://localhost:${args.port}${args.base}`)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
