// Compatibility entry point. All Memories now share the same content-hashed
// campaign renderer, manifest and same-origin output directory.
for (const sceneId of [
  'interlude-01-the-road-remembers',
  'interlude-02-six-voices',
  'interlude-03-what-night-couldnt-kill',
  'interlude-04-the-reflection-that-waits',
  'interlude-05-the-road-beneath-the-tide',
  'interlude-06-thunder-opens-the-vault',
  'interlude-07-every-ending',
  'interlude-08-a-vessel-reforged',
  'interlude-09-the-shape-of-the-wake',
]) {
  process.argv.push('--scene', sceneId)
}

await import('./render-cinematic-voices.mjs')
