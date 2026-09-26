import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendFeed } from './src/send-feed.js'
import { sources } from './src/sources/registry.js'

const root = dirname(fileURLToPath(import.meta.url))
const port = Number(process.env.PORT || 3000)

function feedIdForPath(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/api/all' || path === '/api/all.xml' || path === '/all' || path === '/all.xml') {
    return 'all'
  }
  for (const id of Object.keys(sources)) {
    if ([`/api/${id}`, `/api/${id}.xml`, `/${id}`, `/${id}.xml`].includes(path)) return id
  }
  return null
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost')
    const feedId = feedIdForPath(url.pathname)
    if (feedId) {
      await sendFeed(req, res, feedId)
      return
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = await readFile(join(root, 'public', 'index.html'), 'utf8')
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'public, max-age=300')
      res.end(html)
      return
    }
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Not found')
  } catch (error) {
    console.error(error)
    if (res.headersSent || res.writableEnded) return
    res.statusCode = 500
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Internal error')
  }
})

server.listen(port, () => {
  console.log(`metacritic-rss listening on http://localhost:${port}`)
  console.log(`  games  http://localhost:${port}/api/games.xml`)
  console.log(`  tv     http://localhost:${port}/api/tv.xml`)
  console.log(`  all    http://localhost:${port}/api/all.xml`)
})
