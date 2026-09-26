// Metacritic door pages are Nuxt apps. The listing data is inlined as a
// devalue payload in <script id="__NUXT_DATA__">, not rendered only in the browser.

const UNDEFINED = -1
const HOLE = -2
const NAN = -3
const POSITIVE_INFINITY = -4
const NEGATIVE_INFINITY = -5
const NEGATIVE_ZERO = -6
const SPARSE = -7

const IDENTITY_REVIVERS = new Set([
  'NuxtError',
  'ShallowRef',
  'ShallowReactive',
  'Ref',
  'Reactive',
])

const EMPTY_REVIVERS = new Set(['EmptyShallowRef', 'EmptyRef'])

export function extractNuxtData(html) {
  const marker = 'id="__NUXT_DATA__">'
  const start = html.indexOf(marker)
  if (start === -1) {
    if (/Just a moment|cf-browser-verification|Attention Required/i.test(html)) {
      throw new Error('Metacritic presented a bot check instead of the listing page')
    }
    throw new Error('Metacritic page did not include a Nuxt listing payload')
  }

  const jsonStart = start + marker.length
  const end = html.indexOf('</script>', jsonStart)
  if (end === -1) {
    throw new Error('Nuxt listing payload was truncated')
  }

  try {
    return JSON.parse(html.slice(jsonStart, end))
  } catch (error) {
    throw new Error(`Nuxt listing payload was not valid JSON (${error.message})`)
  }
}

export function reviveNuxtPayload(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Nuxt payload was not a devalue array')
  }

  const hydrated = new Map()

  function hydrate(index) {
    if (index === UNDEFINED) return undefined
    if (index === NAN) return Number.NaN
    if (index === POSITIVE_INFINITY) return Number.POSITIVE_INFINITY
    if (index === NEGATIVE_INFINITY) return Number.NEGATIVE_INFINITY
    if (index === NEGATIVE_ZERO) return -0
    if (typeof index !== 'number' || !Number.isInteger(index)) {
      throw new Error('Invalid Nuxt payload reference')
    }
    if (hydrated.has(index)) return hydrated.get(index)
    if (index < 0 || index >= values.length) {
      throw new Error(`Nuxt payload index out of range: ${index}`)
    }

    const value = values[index]
    if (value === null || typeof value !== 'object') {
      hydrated.set(index, value)
      return value
    }

    if (Array.isArray(value)) {
      if (typeof value[0] === 'string') {
        return hydrateTyped(index, value, hydrate, hydrated, values)
      }

      if (value.length > 0 && value[0] === SPARSE) {
        const sparse = []
        hydrated.set(index, sparse)
        for (let i = 2; i < value.length; i += 2) {
          sparse[value[i]] = hydrate(value[i + 1])
        }
        return sparse
      }

      const array = new Array(value.length)
      hydrated.set(index, array)
      for (let i = 0; i < value.length; i += 1) {
        if (value[i] === HOLE) continue
        array[i] = hydrate(value[i])
      }
      return array
    }

    const object = {}
    hydrated.set(index, object)
    for (const key of Object.keys(value)) {
      if (key === '__proto__') continue
      object[key] = hydrate(value[key])
    }
    return object
  }

  return hydrate(0)
}

function hydrateTyped(index, value, hydrate, hydrated, values) {
  const type = value[0]

  if (IDENTITY_REVIVERS.has(type) || EMPTY_REVIVERS.has(type)) {
    let inner = value[1]
    if (typeof inner !== 'number') {
      values.push(value[1])
      inner = values.length - 1
    }
    hydrated.set(index, undefined)
    let result = hydrate(inner)
    if (EMPTY_REVIVERS.has(type) && (result === '_' || result === undefined)) {
      result = undefined
    }
    hydrated.set(index, result)
    return result
  }

  if (type === 'Date' || type === 'BigInt') {
    hydrated.set(index, value[1])
    return value[1]
  }

  if (type === 'Set') {
    const set = []
    hydrated.set(index, set)
    for (let i = 1; i < value.length; i += 1) set.push(hydrate(value[i]))
    return set
  }

  if (type === 'Map') {
    const map = {}
    hydrated.set(index, map)
    for (let i = 1; i < value.length; i += 2) {
      map[String(hydrate(value[i]))] = hydrate(value[i + 1])
    }
    return map
  }

  if (type === 'null') {
    const object = {}
    hydrated.set(index, object)
    for (let i = 1; i < value.length; i += 2) {
      const key = value[i]
      if (typeof key !== 'string' || key === '__proto__') continue
      object[key] = hydrate(value[i + 1])
    }
    return object
  }

  throw new Error(`Unsupported Nuxt payload type: ${type}`)
}
