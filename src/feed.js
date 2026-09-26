import { fetchMetacriticPage } from './fetch-page.js'
import { renderRss } from './rss.js'
import { dedupeItems } from './items.js'
import { getSource, sources } from './sources/registry.js'

export const SUCCESS_CACHE = 'public, s-maxage=1800, stale-while-revalidate=3600'
const ERROR_CACHE = 'public, s-maxage=60, stale-while-revalidate=120'
const PARTIAL_CACHE = 'public, s-maxage=300, stale-while-revalidate=600'

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
  if (sourceId === 'all') return buildCombined(selfUrl)

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

async function buildCombined(selfUrl) {
  const results = await Promise.all(
    Object.values(sources).map(async (source) => {
      try {
        const html = await fetchMetacriticPage(source.pageUrl)
        const items = source.parse(html)
        return { source, items, error: null }
      } catch (error) {
        console.error(`Feed ${source.id} failed: ${publicError(error)}`)
        return { source, items: [], error }
      }
    }),
  )

  const failures = results.filter((result) => result.error || result.items.length === 0)
  const items = dedupeItems(
    results.flatMap((result) =>
      result.items.map((item) => ({
        ...item,
        sections: item.sections.map((section) => `${result.source.shortLabel}: ${section}`),
      })),
    ),
  )

  if (!items.length) {
    const detail = failures
      .map((result) => `${result.source.shortLabel}: ${publicError(result.error || new Error('no titles found'))}`)
      .join(' ')
    return errorResult(
      {
        title: 'Metacritic Games and TV',
        pageUrl: 'https://www.metacritic.com/',
      },
      selfUrl,
      detail || 'No titles were found.',
    )
  }

  const notes = failures.map((result) => `${result.source.shortLabel} could not be loaded`)
  const description = [
    'Combined current listings from the Metacritic games and TV pages.',
    notes.length ? `${notes.join('. ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    status: 200,
    cacheControl: failures.length ? PARTIAL_CACHE : SUCCESS_CACHE,
    itemCount: items.length,
    xml: renderRss({
      title: 'Metacritic Games and TV',
      link: 'https://www.metacritic.com/',
      selfUrl,
      description,
      items,
    }),
  }
}
