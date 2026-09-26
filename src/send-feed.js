import { buildFeed } from './feed.js'
import { renderRss } from './rss.js'

function header(req, name) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return value
}

export function requestOrigin(req) {
  const forwardedProto = header(req, 'x-forwarded-proto')
  const proto = forwardedProto ? String(forwardedProto).split(',')[0].trim() : 'http'
  const forwardedHost = header(req, 'x-forwarded-host')
  const hostHeader = forwardedHost ? String(forwardedHost).split(',')[0].trim() : header(req, 'host')
  const host = hostHeader || 'localhost'
  return `${proto}://${host}`
}

function selfPath(sourceId) {
  return `/api/${sourceId}.xml`
}

export async function sendFeed(req, res, sourceId) {
  const selfUrl = `${requestOrigin(req)}${selfPath(sourceId)}`
  try {
    const result = await buildFeed(sourceId, selfUrl)
    res.statusCode = result.status
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.setHeader('Cache-Control', result.cacheControl)
    res.setHeader('X-Feed-Items', String(result.itemCount))
    res.end(result.xml)
  } catch (error) {
    console.error(error)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(
      renderRss({
        title: 'Metacritic RSS',
        link: 'https://www.metacritic.com/',
        selfUrl,
        description: 'This feed could not be refreshed. Unexpected server error.',
        items: [],
      }),
    )
  }
}
