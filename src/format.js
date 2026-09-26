const ORIGIN = 'https://www.metacritic.com'

export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function cleanText(value) {
  if (typeof value !== 'string') return null
  const text = value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  if (text.length <= 500) return text
  const cut = text.slice(0, 500)
  const space = cut.lastIndexOf(' ')
  const shortened = space > 320 ? cut.slice(0, space) : cut
  return `${shortened.trimEnd()}…`
}

export function uniqueStrings(values) {
  const seen = new Set()
  const result = []
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

export function finiteNumber(value) {
  if (value == null || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

export function absoluteMetacriticUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return null
  const withSlash = path.endsWith('/') ? path : `${path}/`
  return `${ORIGIN}${withSlash}`
}

export function releaseDateToPubDate(releaseDate) {
  if (typeof releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) return null
  const time = Date.parse(`${releaseDate}T12:00:00Z`)
  if (Number.isNaN(time)) return null
  return new Date(time).toUTCString()
}

export function catalogImageUrl(image) {
  if (!image || typeof image !== 'object') return null
  if (typeof image.path === 'string' && image.path.startsWith('http')) return image.path
  if (typeof image.imageUrl === 'string' && image.imageUrl.startsWith('http')) return image.imageUrl
  if (image.bucketType && image.bucketPath) {
    const bucketPath = String(image.bucketPath).startsWith('/')
      ? image.bucketPath
      : `/${image.bucketPath}`
    return `${ORIGIN}/a/img/${image.bucketType}${bucketPath}`
  }
  return null
}

export function mediaTypeForUrl(url) {
  const clean = url.split('?')[0].toLowerCase()
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.webp')) return 'image/webp'
  if (clean.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

export function readUserScore(userScore) {
  const raw = userScore && typeof userScore === 'object' ? userScore.score : userScore
  return finiteNumber(raw)
}

export function readNames(list) {
  if (!Array.isArray(list)) return []
  return uniqueStrings(list.map((entry) => (entry && typeof entry.name === 'string' ? entry.name : '')))
}

export function readReleaseDate(item) {
  return typeof item.releaseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.releaseDate)
    ? item.releaseDate
    : null
}

export function readRating(item) {
  return typeof item.rating === 'string' && item.rating.trim() ? item.rating.trim() : null
}
