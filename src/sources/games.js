// Games door page: https://www.metacritic.com/game/
// Payload key and card fields live here so a markup change does not require
// editing the TV parser. Product rails are Nuxt `ProductList` components.

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
  uniqueStrings,
} from '../format.js'
import { dedupeItems } from '../items.js'

const PAYLOAD_KEY = 'loadPage:door:games-door-global:'

const PLATFORM_TAGS = {
  pc: 'PC',
  'playstation-5': 'PlayStation 5',
  'playstation-4': 'PlayStation 4',
  'ps5': 'PlayStation 5',
  'ps4': 'PlayStation 4',
  'xbox-series-x': 'Xbox Series X',
  'xbox-series-s': 'Xbox Series S',
  'xbox-one': 'Xbox One',
  'nintendo-switch': 'Nintendo Switch',
  'nintendo-switch-2': 'Nintendo Switch 2',
  ios: 'iOS',
  android: 'Android',
  stadia: 'Stadia',
  'meta-quest': 'Meta Quest',
}

export const gamesSource = {
  id: 'games',
  title: 'Metacritic Games',
  pageUrl: 'https://www.metacritic.com/game/',
  description:
    'Current game listings from the Metacritic games page: newly released titles plus the other product rails on that page (upcoming games and service additions such as Game Pass or PlayStation Plus).',
  parse: parseGames,
}

export function parseGames(html) {
  const page = readDoorPage(html, PAYLOAD_KEY)
  const items = []
  for (const { section, item } of eachProductList(page)) {
    const mapped = mapGame(section, item)
    if (mapped) items.push(mapped)
  }
  return dedupeItems(items)
}

function mapGame(section, item) {
  if (item.type && item.type !== 'game-title') return null
  const title = item.title.trim()
  const link = gameLink(item)
  if (!title || !link) return null

  const critic = item.criticScoreSummary && typeof item.criticScoreSummary === 'object'
    ? item.criticScoreSummary
    : {}
  const releaseDate = readReleaseDate(item)

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
    platforms: gamePlatforms(item),
    network: null,
    genres: readNames(item.genres),
    rating: readRating(item),
    image: catalogImageUrl(item.image),
    sections: [section],
    seasons: null,
  }
}

function gameLink(item) {
  const fromUrl = absoluteMetacriticUrl(item.url)
  if (fromUrl) return fromUrl
  if (typeof item.slug !== 'string' || !item.slug.trim()) return null
  const slug = item.slug.replace(/^\/+|\/+$/g, '')
  return absoluteMetacriticUrl(`/game/${slug}/`)
}

function gamePlatforms(item) {
  const named = readNames(item.platforms)
  if (named.length) return named
  if (!Array.isArray(item.tags)) return []
  const fromTags = []
  for (const tag of item.tags) {
    if (typeof tag !== 'string') continue
    const label = PLATFORM_TAGS[tag]
    if (label) fromTags.push(label)
  }
  return uniqueStrings(fromTags)
}
