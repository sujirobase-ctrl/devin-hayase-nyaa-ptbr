export type Accuracy = 'high' | 'medium' | 'low'

export interface TorrentResult {
  title: string
  link: string
  id?: number
  seeders: number
  leechers: number
  downloads: number
  accuracy: Accuracy
  hash: string
  size: number
  date: Date
  type?: 'batch' | 'best' | 'alt'
}

export interface TorrentQuery {
  media: any
  anilistId: number
  anidbAid?: number
  anidbEid?: number
  tvdbId?: number
  tvdbEId?: number
  imdbId?: string
  tmdbId?: string
  titles: string[]
  episode: number
  episodeCount?: number
  absoluteEpisodeNumber?: number
  resolution: '2160' | '1080' | '720' | '540' | '480' | ''
  exclusions: string[]
  type?: 'sub' | 'dub'
  fetch: typeof globalThis.fetch
}

export type SearchFunction = (
  query: TorrentQuery,
  options?: Record<string, unknown>
) => Promise<TorrentResult[]>

export interface TorrentSource {
  test: () => Promise<boolean>
  single: SearchFunction
  batch: SearchFunction
  movie: SearchFunction
}
