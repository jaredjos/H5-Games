// Compatibility entry point. Intro and finale narration now share the same
// content-hashed campaign renderer as every Memory scene.
process.argv.push(
  '--scene',
  'intro-a-world-without-dawn',
  '--scene',
  'finale-the-first-light',
)

await import('./render-cinematic-voices.mjs')
