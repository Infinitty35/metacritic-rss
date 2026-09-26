import { fetchMetacriticPage } from './fetch-page.js'
import { renderRss } from './rss.js'
import { getSource } from './sources/registry.js'

export const SUCCESS_CACHE = 'public, s-maxage=1800, stale-while-revalidate=3600'
const ERROR_CACHE = 'public, s-maxage=60, stale-while-revalidate=120'

function publicError(error) {
  const message = (error && error.message) || 'Unknown error'
  return message.replace(/\s+/g, ' ').slice(0, 300)
}

function errorResult(source, selfUrl, message) {
  return {
    status: 502,
    cacheControl: ERROR_CACHE,
    itemCount: 0,
    xml: renderRss({
      title: source.title,
      link: source.pageUrl,
      selfUrl,
      description: `This feed could not be refreshed. ${message}`,
      items: [],
    }),
  }
}

export async function buildFeed(sourceId, selfUrl) {
  const source = getSource(sourceId)
  if (!source) {
    return errorResult(
      {
        title: 'Metacritic RSS',
        pageUrl: 'https://www.metacritic.com/',
      },
      selfUrl,
      `Unknown feed "${sourceId}".`,
    )
  }

  try {
    const html = await fetchMetacriticPage(source.pageUrl)
    const items = source.parse(html)
    if (!items.length) {
      return errorResult(
        source,
        selfUrl,
        'The listing page loaded, but no titles were found. Metacritic may have changed its page data.',
      )
    }
    return {
      status: 200,
      cacheControl: SUCCESS_CACHE,
      itemCount: items.length,
      xml: renderRss({
        title: source.title,
        link: source.pageUrl,
        selfUrl,
        description: source.description,
        items,
      }),
    }
  } catch (error) {
    console.error(`Feed ${source.id} failed: ${publicError(error)}`)
    return errorResult(source, selfUrl, publicError(error))
  }
}
