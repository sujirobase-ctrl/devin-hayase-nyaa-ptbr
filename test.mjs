// Smoke test for the Nyaa PT-BR Hayase extension.
// Runs against the real Nyaa.si RSS feed (read-only).

import ext from './nyaa-ptbr.js'

const baseQuery = {
  media: null,
  anilistId: 154587,
  titles: ['Sousou no Frieren', 'Frieren: Beyond Journey\'s End'],
  episode: 1,
  episodeCount: 28,
  resolution: '',
  exclusions: [],
  fetch: globalThis.fetch
}

function summarise (label, results) {
  console.log(`\n=== ${label} (${results.length} results) ===`)
  for (const r of results.slice(0, 5)) {
    console.log(`- [${r.seeders}s/${r.leechers}l] ${r.title}`)
    console.log(`  hash=${r.hash} size=${(r.size / 1024 / 1024).toFixed(1)} MiB date=${r.date?.toISOString?.() ?? r.date}`)
  }
}

async function main () {
  console.log('-> test()')
  const ok = await ext.test()
  console.log('test() =>', ok)

  console.log('\n-> single(Frieren ep 1)')
  const single = await ext.single({ ...baseQuery, episode: 1 })
  summarise('single ep 1', single)

  console.log('\n-> batch(Frieren)')
  const batch = await ext.batch(baseQuery)
  summarise('batch', batch)

  console.log('\n-> single(One Piece ep 1100)')
  const onepiece = await ext.single({
    ...baseQuery,
    anilistId: 21,
    titles: ['One Piece'],
    episode: 1100,
    episodeCount: undefined
  })
  summarise('one piece ep 1100', onepiece)

  console.log('\n-> movie(Suzume)')
  const movie = await ext.movie({
    ...baseQuery,
    anilistId: 154745,
    titles: ['Suzume no Tojimari', 'Suzume'],
    episode: 1
  })
  summarise('Suzume', movie)

  console.log('\n-> single(Solo Leveling 2 ep 1)')
  const solo = await ext.single({
    ...baseQuery,
    anilistId: 178025,
    titles: ['Ore dake Level Up na Ken Season 2', 'Solo Leveling Season 2'],
    episode: 1
  })
  summarise('Solo Leveling S2 ep 1', solo)

  console.log('\nAll smoke checks finished.')
}

main().catch(err => {
  console.error('Test failed:', err)
  process.exitCode = 1
})
