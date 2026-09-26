import { escapeXml, mediaTypeForUrl, uniqueStrings } from './format.js'

function formatUserScore(score) {
  return (Math.round(score * 10) / 10).toFixed(1)
}

function itemDescription(item) {
  // Returned as HTML. The caller escapes the whole string once for the XML text node.
  const parts = []
  if (item.sections.length) {
    parts.push(`<p>Listed in: ${item.sections.join(', ')}</p>`)
  }
  if (item.metascore != null) {
    const detail = []
    if (item.metascoreSentiment) detail.push(item.metascoreSentiment)
    if (item.reviewCount != null) detail.push(`${item.reviewCount} critic reviews`)
    const suffix = detail.length ? ` (${detail.join(', ')})` : ''
    parts.push(`<p><strong>Metascore:</strong> ${item.metascore}${suffix}</p>`)
  }
  if (item.userScore != null) {
    parts.push(`<p><strong>User score:</strong> ${formatUserScore(item.userScore)}/10</p>`)
  }
  if (item.platforms.length) {
    parts.push(`<p><strong>Platform:</strong> ${item.platforms.join(', ')}</p>`)
  }
  if (item.network) {
    parts.push(`<p><strong>Network:</strong> ${item.network}</p>`)
  }
  if (item.releaseDate) {
    parts.push(`<p><strong>Release date:</strong> ${item.releaseDate}</p>`)
  }
  if (item.seasons != null) {
    parts.push(`<p><strong>Seasons:</strong> ${item.seasons}</p>`)
  }
  if (item.rating) {
    parts.push(`<p><strong>Rating:</strong> ${item.rating}</p>`)
  }
  if (item.genres.length) {
    parts.push(`<p><strong>Genres:</strong> ${item.genres.join(', ')}</p>`)
  }
  if (item.summary) {
    parts.push(`<p>${item.summary}</p>`)
  }
  return parts.join('')
}

function categoriesFor(item) {
  return uniqueStrings([...item.platforms, item.network || '', ...item.genres])
}

function renderItem(item) {
  const lines = [
    '    <item>',
    `      <title>${escapeXml(item.title)}</title>`,
    `      <link>${escapeXml(item.link)}</link>`,
    `      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>`,
  ]
  if (item.pubDate) {
    lines.push(`      <pubDate>${escapeXml(item.pubDate)}</pubDate>`)
  }
  const description = itemDescription(item)
  if (description) {
    lines.push(`      <description>${escapeXml(description)}</description>`)
  }
  for (const category of categoriesFor(item)) {
    lines.push(`      <category>${escapeXml(category)}</category>`)
  }
  if (item.image) {
    const type = mediaTypeForUrl(item.image)
    lines.push(
      `      <media:content url="${escapeXml(item.image)}" medium="image" type="${type}"/>`,
    )
    lines.push(`      <enclosure url="${escapeXml(item.image)}" type="${type}" length="0"/>`)
  }
  lines.push('    </item>')
  return lines
}

export function renderRss({ title, link, selfUrl, description, items }) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">',
    '  <channel>',
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(link)}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    '    <language>en-us</language>',
    `    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>`,
    '    <ttl>30</ttl>',
    '    <generator>metacritic-rss</generator>',
    `    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml"/>`,
  ]
  for (const item of items) {
    lines.push(...renderItem(item))
  }
  lines.push('  </channel>', '</rss>', '')
  return lines.join('\n')
}
