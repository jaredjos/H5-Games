import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CINEMATIC_VOICE_MODEL,
  CINEMATIC_VOICE_PROVIDER,
  CINEMATIC_VOICE_SET,
  cinematicManifestRevision,
  validateCinematicVoicePlan,
  verifyCinematicVoiceSet,
} from './cinematic-voice-integrity.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const audioRoot = resolve(root, 'public/assets/cinematics/audio/campaign')
const manifestPath = resolve(audioRoot, 'manifest.json')
const planPath = resolve(root, 'src/story/cinematicVoicePlan.json')
const cinematicSourcePath = resolve(root, 'src/story/cinematics.ts')
const serviceWorkerPath = resolve(root, 'public/sw.js')

const manifestBuffer = await readFile(manifestPath)
const manifest = JSON.parse(manifestBuffer.toString('utf8'))
const plan = validateCinematicVoicePlan(
  JSON.parse(await readFile(planPath, 'utf8')),
)
const cinematicSource = await readFile(cinematicSourcePath, 'utf8')
const serviceWorkerSource = await readFile(serviceWorkerPath, 'utf8')
const directoryEntries = await readdir(audioRoot)

if (
  manifest.provider !== CINEMATIC_VOICE_PROVIDER ||
  manifest.model !== CINEMATIC_VOICE_MODEL ||
  manifest.set !== CINEMATIC_VOICE_SET
) {
  throw new Error('Cinematic narration must use the unified Google campaign pipeline.')
}
if (directoryEntries.some((entry) => entry.endsWith('.partial'))) {
  throw new Error('A partial cinematic narration render is present.')
}

if (
  !cinematicSource.includes("import cinematicVoicePlanJson from './cinematicVoicePlan.json'") ||
  !cinematicSource.includes('CINEMATIC_VOICE_PLAN.map((entry) => [') ||
  !cinematicSource.includes('localCampaignClip(entry.id, cinematicVoiceWindowMs(entry.maximumMs))') ||
  !cinematicSource.includes("const CAMPAIGN_AUDIO_ROOT = 'assets/cinematics/audio/campaign'")
) {
  throw new Error('The cinematic runtime is not mapped to the unified campaign voice plan.')
}

if (
  /https?:\/\//i.test(cinematicSource) ||
  /audio(?:Fallback)?Src\s*:\s*(?:'|"|`)https?:\/\//i.test(cinematicSource) ||
  cinematicSource.includes('NARRATION_REMOTE_REELS') ||
  cinematicSource.includes('assets/cinematics/audio/last-star') ||
  cinematicSource.includes('assets/cinematics/audio/memories')
) {
  throw new Error('External or legacy narration is forbidden in the campaign cinematic runtime.')
}

for (const line of plan) {
  if (!cinematicSource.includes(`'${line.id}'`)) {
    throw new Error(`${line.id} is not referenced by the cinematic runtime.`)
  }
}

const serviceWorkerRevision = serviceWorkerSource.match(
  /const CINEMATIC_VOICE_REVISION = '([^']+)'/,
)?.[1]
if (!serviceWorkerRevision) {
  throw new Error('Service worker is missing the cinematic voice revision marker.')
}
if (
  !serviceWorkerSource.includes('collectCinematicVoiceFiles(manifest)') ||
  !serviceWorkerSource.includes('await precacheCinematicVoices(cache)') ||
  !serviceWorkerSource.includes(
    '`assets/cinematics/audio/campaign/${clip.id}.wav`',
  )
) {
  throw new Error('Service worker does not dynamically precache unified narration clips.')
}

const planIds = new Set(plan.map((line) => line.id))
const wavEntries = directoryEntries.filter((entry) => entry.endsWith('.wav'))
for (const entry of wavEntries) {
  const id = entry.slice(0, -4)
  if (!planIds.has(id)) {
    throw new Error(`Unexpected cinematic narration WAV: ${entry}`)
  }
}

const wavById = new Map()
for (const clip of manifest.clips ?? []) {
  if (typeof clip?.id !== 'string') continue
  wavById.set(clip.id, await readFile(resolve(audioRoot, `${clip.id}.wav`)))
}

const verifiedClipCount = verifyCinematicVoiceSet({
  manifest,
  manifestBuffer,
  plan,
  wavById,
  serviceWorkerRevision,
})

if (manifest.status === 'ready') {
  console.log(
    `Verified ${verifiedClipCount} independent local campaign narration clips.`,
  )
} else {
  console.log(
    `Campaign narration ${manifest.status}: subtitles remain the explicit fallback (${verifiedClipCount}/${plan.length} reusable WAVs present).`,
  )
}

const expectedRevision = cinematicManifestRevision(manifestBuffer)
if (serviceWorkerRevision !== expectedRevision) {
  throw new Error('Cinematic narration manifest revision was not propagated to the service worker.')
}
