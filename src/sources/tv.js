// TV door page: https://www.metacritic.com/tv/
// Payload key and card fields live here so a markup change does not require
// editing the games parser. Product rails are Nuxt `ProductList` components.

import { eachProductList, readDoorPage } from '../door-page.js'
import {
  absoluteMetacriticUrl,
  catalogImageUrl,
  cleanText,
  finiteNumber,
  readNames,
  readRating,
  readReleaseDate,
  readUserScore,
  releaseDateToPubDate,
} from '../format.js'
import { dedupeItems } from '../items.js'

const PAYLOAD_KEY = 'loadPage:door:shows-door-global:'
const SHOW_TYPES = new Set(['show', 'season'])

export const tvSource = {
  id: 'tv',
  title: 'Metacritic TV Shows',
  pageUrl: 'https://www.metacritic.com/tv/',
  description:
    'Current TV listings from the Metacritic TV page: newly released shows and seasons, plus the other product rails on that page (trending, returning, and upcoming).',
  parse: parseTv,
}

export function parseTv(html) {
  const page = readDoorPage(html, PAYLOAD_KEY)
  const items = []
  for (const { section, item } of eachProductList(page)) {
    const mapped = mapShow(section, item)
    if (mapped) items.push(mapped)
  }
  return dedupeItems(items)
}

function mapShow(section, item) {
  if (item.type && !SHOW_TYPES.has(item.type)) return null
  const title = item.title.trim()
  const link = showLink(item)
  if (!title || !link) return null

  const critic = item.criticScoreSummary && typeof item.criticScoreSummary === 'object'
    ? item.criticScoreSummary
    : {}
  const releaseDate = readReleaseDate(item)
  const seasons = finiteNumber(item.numberOfSeasons)

  return {
    title,
    link,
    guid: link,
    pubDate: releaseDate ? releaseDateToPubDate(releaseDate) : null,
    releaseDate,
    summary: cleanText(item.description),
    metascore: finiteNumber(critic.score),
    metascoreSentiment: typeof critic.sentiment === 'string' ? critic.sentiment : null,
    reviewCount: finiteNumber(critic.reviewCount),
    userScore: readUserScore(item.userScore),
    platforms: readNames(item.platforms),
    network: readNetwork(item),
    genres: readNames(item.genres),
    rating: readRating(item),
    image: catalogImageUrl(item.image),
    sections: [section],
    seasons: seasons != null && seasons > 0 ? seasons : null,
  }
}

function showLink(item) {
  const fromUrl = absoluteMetacriticUrl(item.url)
  if (fromUrl) return fromUrl
  if (typeof item.slug !== 'string' || !item.slug.trim()) return null
  const slug = item.slug.replace(/^\/+|\/+$/g, '')
  return absoluteMetacriticUrl(`/tv/${slug}/`)
}

function readNetwork(item) {
  const network = item.network
  if (typeof network === 'string' && network.trim()) return network.trim()
  if (network && typeof network === 'object' && typeof network.name === 'string' && network.name.trim()) {
    return network.name.trim()
  }
  return null
}
