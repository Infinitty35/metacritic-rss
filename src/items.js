import { uniqueStrings } from './format.js'

function richness(item) {
  let score = 0
  if (item.summary) score += 4
  if (item.releaseDate) score += 3
  if (item.metascore != null) score += 2
  if (item.userScore != null) score += 1
  if (item.image) score += 1
  if (item.platforms.length) score += 1
  if (item.network) score += 1
  return score
}

function longerText(left, right) {
  if (!left) return right || null
  if (!right) return left
  return right.length > left.length ? right : left
}

function mergeItems(left, right) {
  const primary = richness(left) >= richness(right) ? left : right
  const secondary = primary === left ? right : left
  return {
    ...primary,
    pubDate: primary.pubDate || secondary.pubDate,
    releaseDate: primary.releaseDate || secondary.releaseDate,
    summary: longerText(primary.summary, secondary.summary),
    metascore: primary.metascore ?? secondary.metascore,
    metascoreSentiment: primary.metascoreSentiment || secondary.metascoreSentiment,
    reviewCount: primary.reviewCount ?? secondary.reviewCount,
    userScore: primary.userScore ?? secondary.userScore,
    platforms: uniqueStrings([...primary.platforms, ...secondary.platforms]),
    network: primary.network || secondary.network,
    genres: uniqueStrings([...primary.genres, ...secondary.genres]),
    rating: primary.rating || secondary.rating,
    image: primary.image || secondary.image,
    sections: uniqueStrings([...primary.sections, ...secondary.sections]),
    seasons: primary.seasons ?? secondary.seasons,
  }
}

export function sortItems(items) {
  return [...items].sort((left, right) => {
    if (left.pubDate && right.pubDate) {
      const byDate = Date.parse(right.pubDate) - Date.parse(left.pubDate)
      if (byDate !== 0) return byDate
    } else if (left.pubDate) {
      return -1
    } else if (right.pubDate) {
      return 1
    }
    return left.title.localeCompare(right.title)
  })
}

export function dedupeItems(items) {
  const byLink = new Map()
  for (const item of items) {
    const existing = byLink.get(item.link)
    byLink.set(item.link, existing ? mergeItems(existing, item) : item)
  }
  return sortItems([...byLink.values()])
}
