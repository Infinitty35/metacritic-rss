import { sendFeed } from '../src/send-feed.js'

export default function handler(req, res) {
  return sendFeed(req, res, 'games')
}
