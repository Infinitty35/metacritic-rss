import { gamesSource } from './games.js'
import { tvSource } from './tv.js'

export const sources = {
  games: gamesSource,
  tv: tvSource,
}

export function getSource(id) {
  return sources[id] || null
}
