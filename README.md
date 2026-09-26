# Metacritic RSS

Self-hosted RSS 2.0 feeds for the Metacritic games and TV listing pages. Each feed is built from the listing data embedded in those pages, so a feed reader can follow new titles without rss.app.

The games page (`https://www.metacritic.com/game/`) and the TV page (`https://www.metacritic.com/tv/`) are Nuxt apps. Their product rails (newly released, upcoming, service additions, trending, and returning shows) are included in the server-rendered `__NUXT_DATA__` payload. This service reads that payload, maps each title to an RSS item, and caches the result.

## Feed URLs

On a local server:

| Feed | URL |
| --- | --- |
| Games | http://localhost:3000/api/games.xml |
| TV shows | http://localhost:3000/api/tv.xml |
| Games and TV | http://localhost:3000/api/all.xml |

The same feeds are also served at `/games`, `/games.xml`, `/tv`, `/tv.xml`, `/all`, and `/all.xml`.

After you deploy, replace the host:

- `https://<your-project>.vercel.app/api/games.xml`
- `https://<your-project>.vercel.app/api/tv.xml`
- `https://<your-project>.vercel.app/api/all.xml`

Each item includes a title, a link to the Metacritic page, and that same URL as a permalink `guid`. When the page provides them, the item also includes a Metascore, user score, release date, platform or network, genres, a short description, and a thumbnail (`media:content` and `enclosure`). `pubDate` is the release date at 12:00 GMT, so it stays the same between fetches. Items with no release date omit `pubDate` rather than using the current time.

Responses send `Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600` (about 30 minutes, then stale-while-revalidate for another hour). A failed refresh returns a short-lived valid RSS document with HTTP 502 and the reason in the channel description.

## Deploy on Vercel

No environment variables or build command are required.

1. Push this repository to GitHub.
2. In the [Vercel dashboard](https://vercel.com/new), choose **Add New… → Project** and **Import** the GitHub repository.
3. Leave the framework preset as **Other**. The root directory is the repository root. Install and build commands can stay empty; there are no npm dependencies.
4. Deploy.

Vercel serves `api/games.js`, `api/tv.js`, and `api/all.js` as Node.js serverless functions. `vercel.json` rewrites the shorter paths onto those functions. The homepage is the static file `public/index.html`.

Hobby/free tier limits apply. The functions only run when the CDN cache misses, because of the `s-maxage` header.

## Run locally

Node.js 18 or newer is enough. There is no install step.

```bash
node server.js
```

Then open http://localhost:3000. The process prints the feed URLs. `npm start` runs the same command.

## Check the feeds

With the server running in another terminal:

```bash
python3 scripts/validate-feeds.py
```

`npm run validate` does the same thing. The script starts its own server on port 3999, fetches both feeds plus the combined feed, and checks that the XML is RSS 2.0 with real items (titles, Metacritic links, stable guids, release-date `pubDate`s, scores, and thumbnails).

## Add another feed

Listing parsers are split by source:

- `src/sources/games.js` reads the games door page
- `src/sources/tv.js` reads the TV door page
- `src/sources/registry.js` registers them

Both pages currently share a door-page shape: a Nuxt payload key such as `loadPage:door:games-door-global:` and `ProductList` components. `src/door-page.js` only finds that page object and walks those components. Field mapping stays in the source file.

To add a page, for example movies:

1. Open the Metacritic page and confirm the HTML contains `<script id="__NUXT_DATA__">`. The payload key is the `loadPage:door:…` entry for that page. If the card JSON differs, map it in the new file instead of reusing the games or TV mapper.
2. Add `src/sources/movies.js` that exports a source object with `id`, `title`, `pageUrl`, `description`, `shortLabel`, and `parse(html)`.
3. Register it in `src/sources/registry.js`.
4. Add `api/movies.js`:

   ```js
   import { sendFeed } from '../src/send-feed.js'

   export default function handler(req, res) {
     return sendFeed(req, res, 'movies')
   }
   ```

5. Add rewrites for `/movies` and `/movies.xml` in `vercel.json`. The local server picks up any id in the registry automatically (`/api/movies.xml` and `/movies`).
6. Run `python3 scripts/validate-feeds.py` after extending the script if you want the new feed checked too.

The combined feed includes every source in the registry.

## Limitations

- The door pages include the product carousels rendered into the HTML (on the order of the newly released rail plus the other rails), not the full browse catalog of every game or show.
- A new-release game card lists one platform, not every platform the game ships on. Other rails sometimes only leave a platform slug in tags (`pc`, `playstation-5`, and similar).
- New TV cards in this payload often have `network: null` and an empty platform list, so network is missing even when a show has one. Streaming services do show up on cards that include a platforms array.
- The all-time “best on this platform” carousel is omitted. It is not a current listing.
- News articles and videos on the same pages are omitted.
- Unreviewed titles have no Metascore yet. New releases often have no user score yet.
- Thumbnail `enclosure` length is `0` because the page payload does not include a file size. `media:content` points at the same image.
- Metacritic can change the Nuxt payload or answer with a bot check. The feed then returns a valid error document instead of crashing. Fix the matching file under `src/sources/` when a page’s fields move.
