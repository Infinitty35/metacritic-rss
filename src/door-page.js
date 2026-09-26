import { extractNuxtData, reviveNuxtPayload } from './nuxt-payload.js'

// All-time "best on this platform" carousels are not current listings.
const DEFAULT_SKIP = new Set(['best-on-carousel'])

export function readDoorPage(html, payloadKey) {
  const revived = reviveNuxtPayload(extractNuxtData(html))
  const data = revived && revived.data
  if (!data || typeof data !== 'object') {
    throw new Error('Nuxt payload did not include page data')
  }
  if (data[payloadKey]) return data[payloadKey]

  const match = Object.keys(data).find((key) => key.startsWith(payloadKey))
  if (!match) {
    throw new Error(`Nuxt payload did not include ${payloadKey}`)
  }
  return data[match]
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return 'Listing'
}

export function eachProductList(page, options = {}) {
  const skip = options.skipComponents || DEFAULT_SKIP
  const components = Array.isArray(page?.components) ? page.components : []
  const found = []

  for (const component of components) {
    if (!component || typeof component !== 'object') continue
    const meta = component.meta && typeof component.meta === 'object' ? component.meta : {}
    const data = component.data && typeof component.data === 'object' ? component.data : {}
    const name = typeof meta.componentName === 'string' ? meta.componentName : ''
    if (skip.has(name)) continue
    if (meta.componentType && meta.componentType !== 'ProductList') continue

    const section = firstText(data.title, meta.componentDisplayName, meta.componentName)
    const rawItems = Array.isArray(data.items) ? data.items : []
    for (const item of rawItems) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue
      if (typeof item.title !== 'string' || !item.title.trim()) continue
      found.push({ section, item })
    }
  }

  return found
}
