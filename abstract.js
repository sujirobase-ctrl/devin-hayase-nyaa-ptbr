/**
 * @typedef {import('./types').TorrentSource} TorrentSource
 */

/**
 * @implements {TorrentSource}
 */
export default class AbstractSource {
  /** @type {import('./types').SearchFunction} */
  single () { throw new Error('Source doesn\'t implement single') }

  /** @type {import('./types').SearchFunction} */
  batch () { throw new Error('Source doesn\'t implement batch') }

  /** @type {import('./types').SearchFunction} */
  movie () { throw new Error('Source doesn\'t implement movie') }

  /** @type {() => Promise<boolean>} */
  test () { throw new Error('Source doesn\'t implement test') }
}
