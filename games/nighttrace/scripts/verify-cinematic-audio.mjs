import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  inspectMemoryWav,
  verifyReadyMemoryVoiceSet,
} from './memory-voice-integrity.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lastStarAudioRoot = resolve(root, 'public/assets/cinematics/audio/last-star')
const lastStarManifestPath = resolve(lastStarAudioRoot, 'manifest.json')
const memoryAudioRoot = resolve(root, 'public/assets/cinematics/audio/memories')
const memoryManifestPath = resolve(memoryAudioRoot, 'manifest.json')
const memoryPlanPath = resolve(root, 'src/story/memoryVoicePlan.json')
const cinematicSourcePath = resolve(root, 'src/story/cinematics.ts')
const serviceWorkerPath = resolve(root, 'public/sw.js')

const manifest = JSON.parse(await readFile(lastStarManifestPath, 'utf8'))
const cinematicSource = await readFile(cinematicSourcePath, 'utf8')
const directoryEntries = await readdir(lastStarAudioRoot)

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

  const wav = await readFile(resolve(lastStarAudioRoot, `${clip.id}.wav`))
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

const expectedMemoryVoiceBySpeaker = Object.freeze({
  'Last Star': 'Leda',
  Bearer: 'Orus',
  'Sun-Eater': 'Algenib',
  'Cartographer echo': 'Rasalgethi',
})

const memoryManifestBuffer = await readFile(memoryManifestPath)
const memoryManifest = JSON.parse(memoryManifestBuffer.toString('utf8'))
const memoryPlan = JSON.parse(await readFile(memoryPlanPath, 'utf8'))
const memoryDirectoryEntries = await readdir(memoryAudioRoot)
const serviceWorkerSource = await readFile(serviceWorkerPath, 'utf8')

if (memoryManifest.provider !== 'Google Gemini API') {
  throw new Error(`Unexpected Memory narration provider: ${memoryManifest.provider}`)
}
if (memoryManifest.model !== 'gemini-3.1-flash-tts-preview') {
  throw new Error(`Unexpected Memory narration model: ${memoryManifest.model}`)
}
if (
  memoryManifest.set !== 'memories-i-ix' ||
  memoryManifest.expectedClipCount !== 22
) {
  throw new Error('Memory narration manifest has an invalid set or clip count.')
}
if (!Array.isArray(memoryPlan) || memoryPlan.length !== 22) {
  throw new Error('Memory voice plan must contain exactly 22 lines.')
}
if (memoryDirectoryEntries.some((entry) => entry.endsWith('.partial'))) {
  throw new Error('A partial Memory narration render is present.')
}
if (
  !cinematicSource.includes('MEMORY_VOICE_PLAN.map((entry) => [') ||
  !cinematicSource.includes('localMemoryClip(entry.id, entry.maximumMs)') ||
  !cinematicSource.includes("const MEMORY_AUDIO_ROOT = 'assets/cinematics/audio/memories'")
) {
  throw new Error('Memory narration plan is not mapped into the cinematic runtime.')
}

const planById = new Map()
for (const entry of memoryPlan) {
  if (
    !entry ||
    typeof entry.id !== 'string' ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) ||
    planById.has(entry.id)
  ) {
    throw new Error(`Invalid or duplicate Memory voice plan id: ${String(entry?.id)}`)
  }
  if (
    expectedMemoryVoiceBySpeaker[entry.speaker] !== entry.voiceName ||
    typeof entry.text !== 'string' ||
    entry.text.trim().length < 2 ||
    !Number.isInteger(entry.maximumMs) ||
    entry.maximumMs <= 0
  ) {
    throw new Error(`Invalid Memory voice plan entry: ${entry.id}`)
  }
  if (!cinematicSource.includes(`'${entry.id}'`)) {
    throw new Error(`${entry.id} is not present in the cinematic dialogue source.`)
  }
  planById.set(entry.id, entry)
}

const serviceWorkerRevision = serviceWorkerSource.match(
  /const MEMORY_VOICE_REVISION = '([^']+)'/,
)?.[1]
if (!serviceWorkerRevision) {
  throw new Error('Service worker is missing the Memory voice revision marker.')
}
if (
  !serviceWorkerSource.includes('collectMemoryVoiceFiles(manifest)') ||
  !serviceWorkerSource.includes('await precacheMemoryVoices(cache)')
) {
  throw new Error('Service worker does not precache ready Memory narration clips.')
}

const memoryWavEntries = memoryDirectoryEntries.filter((entry) =>
  entry.endsWith('.wav'),
)
for (const entry of memoryWavEntries) {
  const id = entry.slice(0, -4)
  const plan = planById.get(id)
  if (!plan) throw new Error(`Unexpected Memory narration WAV: ${entry}`)
  const wav = await readFile(resolve(memoryAudioRoot, entry))
  const durationMs = inspectMemoryWav(wav, entry)
  if (durationMs > plan.maximumMs) {
    throw new Error(`${entry} exceeds its ${plan.maximumMs}ms cinematic window.`)
  }
}

if (memoryManifest.status === 'pending-generation') {
  if (!Array.isArray(memoryManifest.clips) || memoryManifest.clips.length !== 0) {
    throw new Error('Pending Memory narration manifest must not claim ready clips.')
  }
  if (serviceWorkerRevision !== 'pending') {
    throw new Error('Pending Memory narration must retain the pending service-worker revision.')
  }
  console.log(
    `Memory narration pending-generation: subtitles remain the explicit fallback (${memoryWavEntries.length}/22 reusable WAVs present).`,
  )
} else if (memoryManifest.status === 'ready') {
  if (!Array.isArray(memoryManifest.clips) || memoryManifest.clips.length !== 22) {
    throw new Error('Ready Memory narration manifest must contain exactly 22 clips.')
  }

  if (memoryWavEntries.length !== 22) {
    throw new Error('Ready Memory narration directory must contain exactly 22 WAVs.')
  }
  const wavById = new Map()
  for (const id of planById.keys()) {
    wavById.set(id, await readFile(resolve(memoryAudioRoot, `${id}.wav`)))
  }
  verifyReadyMemoryVoiceSet({
    manifest: memoryManifest,
    manifestBuffer: memoryManifestBuffer,
    plan: memoryPlan,
    wavById,
    serviceWorkerRevision,
  })
  console.log('Verified 22 local Memory narration clips and service-worker precache mapping.')
} else {
  throw new Error(`Unknown Memory narration status: ${String(memoryManifest.status)}`)
}
