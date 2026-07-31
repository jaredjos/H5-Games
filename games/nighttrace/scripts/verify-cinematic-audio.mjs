import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const audioRoot = resolve(root, 'public/assets/cinematics/audio/last-star')
const manifestPath = resolve(audioRoot, 'manifest.json')
const cinematicSourcePath = resolve(root, 'src/story/cinematics.ts')

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const cinematicSource = await readFile(cinematicSourcePath, 'utf8')
const directoryEntries = await readdir(audioRoot)

if (manifest.provider !== 'Google Gemini API') {
  throw new Error(`Unexpected Last Star provider: ${manifest.provider}`)
}
if (manifest.voice !== 'Leda') {
  throw new Error(`Unexpected Last Star voice: ${manifest.voice}`)
}
if (!Array.isArray(manifest.clips) || manifest.clips.length !== 7) {
  throw new Error('The Last Star manifest must contain exactly seven clips.')
}
if (directoryEntries.some((entry) => entry.endsWith('.partial'))) {
  throw new Error('A partial Last Star narration render is present.')
}

const seenIds = new Set()
for (const clip of manifest.clips) {
  if (seenIds.has(clip.id)) {
    throw new Error(`Duplicate Last Star clip id: ${clip.id}`)
  }
  seenIds.add(clip.id)

  const wav = await readFile(resolve(audioRoot, `${clip.id}.wav`))
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${clip.id}.wav is not a valid RIFF/WAVE asset.`)
  }

  const byteRate = wav.readUInt32LE(28)
  const dataBytes = wav.readUInt32LE(40)
  const durationMs = Math.round((dataBytes / byteRate) * 1_000)
  if (durationMs !== clip.durationMs || wav.length !== clip.bytes) {
    throw new Error(`${clip.id}.wav does not match its manifest metadata.`)
  }

  const escapedId = clip.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const binding = new RegExp(
    `'${escapedId}'\\s*:\\s*localLastStarClip\\('${escapedId}',\\s*${durationMs.toLocaleString('en-US').replace(',', '_')}\\)`,
  )
  if (!binding.test(cinematicSource)) {
    throw new Error(`${clip.id} is not mapped to its exact ${durationMs}ms runtime window.`)
  }
}

console.log(`Verified ${manifest.clips.length} local Last Star narration clips.`)
