/**
 * Nyaa PT-BR Hayase extension. Indexes Brazilian-Portuguese anime torrents
 * available on Nyaa.si and returns them as Hayase TorrentResult objects.
 *
 * Self-contained ES module: no relative imports, no external dependencies.
 */

class AbstractSource {
  single () { throw new Error("Source doesn't implement single") }
  batch () { throw new Error("Source doesn't implement batch") }
  movie () { throw new Error("Source doesn't implement movie") }
  test () { throw new Error("Source doesn't implement test") }
}

const NYAA_BASE = 'https://nyaa.si'
const RSS_PATH = '/?page=rss'
const ANIME_CATEGORY = '1_0'

const PT_BR_REGEX = /\b(PT[\s_-]?BR|PTBR|Portugu(?:e|ê)s|Brasil|Brazilian|Dublado|Legendado(?:\s+em\s+Portugu(?:e|ê)s)?|\[BR\]|\(BR\)|\bDUB\s*PT\b|\bSUB\s*PT\b)\b/i
const KNOWN_GROUPS = [
  'Anitsu', 'WF', 'FenixFansub', 'FênixFansub', 'Anime no Sekai',
  'Kekkan', 'SubVision', 'HollowStudios', 'AYA', 'Sully FANSUB',
  'Punch Sub', 'PunchSub', 'CocaSubs', 'Trix'
]
const KNOWN_GROUPS_REGEX = new RegExp('\\[(?:' + KNOWN_GROUPS.map(g => g.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\]', 'i')

const BATCH_REGEX = /\b(BATCH|S\d+(?!E)|Season|Complete|Completo|Saga|BD|Blu-?Ray|01-\d{2,3}|1-\d{2,3}|01~\d{2,3}|FULL|END)\b/i
const MOVIE_REGEX = /\b(Movie|Filme|Film|劇場版|the\s+Movie)\b/i

/**
 * Decode XML entities used by Nyaa RSS payloads.
 * @param {string} str
 * @returns {string}
 */
function decodeEntities (str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

/**
 * Convert a Nyaa-formatted size string (e.g. "1.2 GiB") to bytes.
 * @param {string} sizeStr
 * @returns {number}
 */
function parseSize (sizeStr) {
  if (!sizeStr) return 0
  const match = sizeStr.match(/([0-9]+(?:\.[0-9]+)?)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB|B)/i)
  if (!match) return 0
  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  const multipliers = {
    B: 1,
    KIB: 1024, KB: 1024,
    MIB: 1024 ** 2, MB: 1024 ** 2,
    GIB: 1024 ** 3, GB: 1024 ** 3,
    TIB: 1024 ** 4, TB: 1024 ** 4
  }
  return Math.round(value * (multipliers[unit] ?? 1))
}

/**
 * Extract the text content for a single tag inside an `<item>` block.
 * @param {string} item
 * @param {string} tag
 * @returns {string | null}
 */
function extractTag (item, tag) {
  const re = new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const match = item.match(re)
  if (!match) return null
  let text = match[1].trim()
  const cdata = text.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/)
  if (cdata) text = cdata[1]
  return text
}

/**
 * Parse a Nyaa RSS payload into raw torrent records.
 * @param {string} xml
 */
function parseRSS (xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const title = decodeEntities(extractTag(block, 'title') ?? '').trim()
    const link = decodeEntities(extractTag(block, 'link') ?? '').trim()
    const guid = decodeEntities(extractTag(block, 'guid') ?? '').trim()
    const pubDate = extractTag(block, 'pubDate')
    const infoHash = (extractTag(block, 'nyaa:infoHash') ?? '').trim().toLowerCase()
    const seeders = parseInt(extractTag(block, 'nyaa:seeders') ?? '0', 10) || 0
    const leechers = parseInt(extractTag(block, 'nyaa:leechers') ?? '0', 10) || 0
    const downloads = parseInt(extractTag(block, 'nyaa:downloads') ?? '0', 10) || 0
    const size = parseSize(extractTag(block, 'nyaa:size') ?? '')
    const categoryId = (extractTag(block, 'nyaa:categoryId') ?? '').trim()

    if (!infoHash || !title) continue

    const idMatch = guid.match(/\/view\/(\d+)/)
    const id = idMatch ? parseInt(idMatch[1], 10) : undefined

    items.push({
      title,
      link,
      guid,
      pubDate: pubDate ? new Date(pubDate) : new Date(),
      hash: infoHash,
      seeders,
      leechers,
      downloads,
      size,
      categoryId,
      id
    })
  }
  return items
}

/**
 * Heuristically pull the episode number from a release title.
 * @param {string} title
 * @returns {number | null}
 */
function parseEpisode (title) {
  const cleaned = title
    .replace(/\b(720p|1080p|2160p|480p|540p|x264|x265|H\.?264|H\.?265|HEVC|AAC|FLAC|Opus|10bit|8bit)\b/gi, ' ')
    .replace(/\b(BD|BDRip|WEB-?DL|WEBRip|WEB|TVRip)\b/gi, ' ')

  const m1 = cleaned.match(/\bS\d+E(\d+)\b/i)
  if (m1) return parseInt(m1[1], 10)

  const m2 = cleaned.match(/(?:^|\s|-)([0-9]{1,4})v\d\b/)
  if (m2) return parseInt(m2[1], 10)

  const m3 = cleaned.match(/\s-\s(\d{1,4})(?:\s|$|\[)/)
  if (m3) return parseInt(m3[1], 10)

  const m4 = cleaned.match(/\bE(?:p(?:isode|isodio)?)?\.?\s*(\d{1,4})\b/i)
  if (m4) return parseInt(m4[1], 10)

  return null
}

/**
 * Parse a "01-12" or similar range string from the title.
 * @param {string} title
 * @returns {[number, number] | null}
 */
function parseEpisodeRange (title) {
  const m = title.match(/(\d{1,4})\s*[-~]\s*(\d{1,4})/)
  if (!m) return null
  const start = parseInt(m[1], 10)
  const end = parseInt(m[2], 10)
  if (end < start || end > 2000) return null
  return [start, end]
}

/**
 * Determine whether a release title clearly references PT-BR content.
 * @param {string} title
 * @returns {boolean}
 */
function isPtBr (title) {
  if (PT_BR_REGEX.test(title)) return true
  if (KNOWN_GROUPS_REGEX.test(title)) return true
  return false
}

/**
 * Detect whether a release looks like a batch/season pack rather than a single episode.
 * @param {string} title
 * @returns {boolean}
 */
function looksLikeBatch (title) {
  if (parseEpisodeRange(title)) return true
  return BATCH_REGEX.test(title)
}

/**
 * Detect whether a release looks like a movie release.
 * @param {string} title
 * @returns {boolean}
 */
function looksLikeMovie (title) {
  return MOVIE_REGEX.test(title)
}

/**
 * Sanitise an anime title into something Nyaa's search can match reliably.
 * @param {string} title
 * @returns {string}
 */
function normaliseTitle (title) {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Choose the most useful, distinct titles to query Nyaa with.
 * @param {string[]} titles
 * @returns {string[]}
 */
function pickQueryTitles (titles) {
  const seen = new Set()
  const picks = []
  for (const raw of titles ?? []) {
    if (!raw) continue
    const normalised = normaliseTitle(raw)
    if (!normalised) continue
    const key = normalised.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    picks.push(normalised)
    if (picks.length >= 3) break
  }
  return picks
}

/**
 * Build the list of Nyaa RSS URLs to fetch for a single search invocation.
 * @param {string} title
 * @param {{ type?: 'sub' | 'dub' }} query
 */
function buildQueries (title, query) {
  const base = `${NYAA_BASE}${RSS_PATH}&c=${ANIME_CATEGORY}&f=0&s=seeders&o=desc`
  const queries = [
    `${base}&q=${encodeURIComponent(`${title} PT-BR`)}`,
    `${base}&q=${encodeURIComponent(`${title} Anitsu`)}`,
    `${base}&q=${encodeURIComponent(`${title} WF`)}`
  ]
  if (query.type === 'dub') {
    queries.push(`${base}&q=${encodeURIComponent(`${title} Dublado`)}`)
  }
  return queries
}

/**
 * Build a magnet link, appending a few public trackers for warmer swarms.
 * @param {string} hash
 * @param {string} title
 * @returns {string}
 */
function buildMagnet (hash, title) {
  const trackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://exodus.desync.com:6969/announce',
    'udp://tracker.openbittorrent.com:6969/announce'
  ]
  const params = new URLSearchParams()
  params.set('xt', `urn:btih:${hash}`)
  params.set('dn', title)
  for (const tracker of trackers) params.append('tr', tracker)
  return `magnet:?${params.toString()}`
}

/**
 * Fetch and parse one Nyaa RSS URL with timeouts and silent failures so a
 * dead mirror or rate-limit never kills the entire result set.
 * @param {string} url
 * @param {typeof fetch} fetcher
 */
async function fetchRSS (url, fetcher) {
  const fn = fetcher ?? globalThis.fetch
  try {
    const res = await fn(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*'
      }
    })
    if (!res.ok) return []
    const text = await res.text()
    return parseRSS(text)
  } catch (_err) {
    return []
  }
}

/**
 * Run the configured Nyaa queries for the given anime titles and return the
 * deduplicated set of PT-BR-only candidates.
 *
 * @param {import('./types').TorrentQuery} query
 */
async function fetchCandidates (query) {
  const titles = pickQueryTitles(query.titles)
  if (titles.length === 0) return []

  const urls = []
  for (const title of titles) {
    for (const url of buildQueries(title, query)) {
      if (!urls.includes(url)) urls.push(url)
    }
  }

  const results = await Promise.all(urls.map(u => fetchRSS(u, query.fetch)))

  const merged = new Map()
  for (const list of results) {
    for (const item of list) {
      if (!isPtBr(item.title)) continue
      const existing = merged.get(item.hash)
      if (!existing || existing.seeders < item.seeders) {
        merged.set(item.hash, item)
      }
    }
  }
  return [...merged.values()]
}

/**
 * Check whether the title's resolution clears Hayase's resolution floor.
 * @param {string} title
 * @param {string} required
 */
function matchesResolution (title, required) {
  if (!required) return true
  const target = required + 'p'
  const found = title.match(/\b(2160p|1080p|720p|540p|480p)\b/i)
  if (!found) return true
  const num = parseInt(found[1], 10)
  const req = parseInt(required, 10)
  return num >= req
}

/**
 * Filter out titles containing any of Hayase's user/codec exclusion keywords.
 * @param {string} title
 * @param {string[]} exclusions
 */
function passesExclusions (title, exclusions) {
  if (!exclusions || exclusions.length === 0) return true
  const lower = title.toLowerCase()
  return !exclusions.some(ex => ex && lower.includes(ex.toLowerCase()))
}

/**
 * Map a raw parsed Nyaa record into a Hayase-shaped TorrentResult.
 * @param {ReturnType<typeof parseRSS>[number]} item
 * @returns {import('./types').TorrentResult}
 */
function toResult (item) {
  return {
    title: item.title,
    link: buildMagnet(item.hash, item.title),
    hash: item.hash,
    id: item.id,
    seeders: item.seeders,
    leechers: item.leechers,
    downloads: item.downloads,
    accuracy: 'medium',
    size: item.size,
    date: item.pubDate
  }
}

export default new class NyaaPtBr extends AbstractSource {
  /** @type {import('./types').SearchFunction} */
  async single (query) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return []
    const candidates = await fetchCandidates(query)
    const episode = Number(query.episode ?? query.absoluteEpisodeNumber ?? 0)

    const filtered = candidates
      .filter(c => passesExclusions(c.title, query.exclusions))
      .filter(c => matchesResolution(c.title, query.resolution))

    const ranked = filtered
      .map(c => {
        const ep = parseEpisode(c.title)
        const range = parseEpisodeRange(c.title)
        const isBatch = looksLikeBatch(c.title)
        const isMovie = looksLikeMovie(c.title)

        let score = 0
        if (episode > 0) {
          if (ep === episode) score += 100
          if (range && episode >= range[0] && episode <= range[1]) score += 60
          if (!ep && !range && !isBatch && !isMovie) score += 10
        } else if (!isBatch && !isMovie) {
          score += 10
        }

        if (isMovie && episode > 1) score -= 50
        return { item: c, score }
      })
      .filter(r => r.score >= 0)
      .sort((a, b) => b.score - a.score || b.item.seeders - a.item.seeders)

    return ranked.map(r => toResult(r.item))
  }

  /** @type {import('./types').SearchFunction} */
  async batch (query) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return []
    const candidates = await fetchCandidates(query)

    const ranked = candidates
      .filter(c => passesExclusions(c.title, query.exclusions))
      .filter(c => matchesResolution(c.title, query.resolution))
      .map(c => {
        const range = parseEpisodeRange(c.title)
        const isBatch = looksLikeBatch(c.title)
        let score = 0
        if (range) {
          score += 80
          if (query.episodeCount && range[1] >= query.episodeCount) score += 20
        }
        if (isBatch) score += 40
        return { item: c, score }
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score || b.item.seeders - a.item.seeders)

    return ranked.map(r => {
      const result = toResult(r.item)
      result.type = 'batch'
      return result
    })
  }

  /** @type {import('./types').SearchFunction} */
  async movie (query) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return []
    const candidates = await fetchCandidates(query)
    const ranked = candidates
      .filter(c => passesExclusions(c.title, query.exclusions))
      .filter(c => matchesResolution(c.title, query.resolution))
      .map(c => {
        let score = 0
        if (looksLikeMovie(c.title)) score += 60
        if (!parseEpisode(c.title) && !parseEpisodeRange(c.title)) score += 20
        return { item: c, score }
      })
      .filter(r => r.score >= 0)
      .sort((a, b) => b.score - a.score || b.item.seeders - a.item.seeders)

    return ranked.map(r => toResult(r.item))
  }

  async test () {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
    const res = await fetch(`${NYAA_BASE}/?page=rss&c=1_0&q=PT-BR&f=0`, {
      headers: { Accept: 'application/rss+xml' }
    })
    if (!res.ok) throw new Error(`Falha ao alcançar Nyaa.si: HTTP ${res.status}. Pode ser bloqueio de rede ou CORS.`)
    const xml = await res.text()
    const parsed = parseRSS(xml)
    if (parsed.length === 0) throw new Error('Nyaa.si respondeu, mas o feed PT-BR está vazio no momento. Tente novamente mais tarde.')
    return true
  }
}()
