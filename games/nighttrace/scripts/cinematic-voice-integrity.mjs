import { createHash } from 'node:crypto'

export const CINEMATIC_VOICE_PROVIDER = 'Google Gemini API'
export const CINEMATIC_VOICE_MODEL = 'gemini-3.1-flash-tts-preview'
export const CINEMATIC_VOICE_SET = 'campaign'
export const CINEMATIC_VOICE_PROMPT_REVISION = 'nighttrace-campaign-v1'
// Google TTS naturally varies by several hundred milliseconds even when given
// an explicit pace. Keep the authored value as the dialogue target while
// allowing a short, deterministic safety window so a complete take is never
// rejected or clipped solely for sounding natural.
export const CINEMATIC_VOICE_HEADROOM_MS = 1_600

export function cinematicVoiceWindowMs(line) {
  return line.maximumMs + CINEMATIC_VOICE_HEADROOM_MS
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HASH_PATTERN = /^[a-f0-9]{64}$/
const DELIVERY_PROFILES = new Set(['standard', 'spacious'])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizedPlanEntry(entry) {
  return {
    id: entry.id,
    sceneId: entry.sceneId,
    speaker: entry.speaker,
    text: entry.text.trim().normalize('NFC'),
    voiceName: entry.voiceName,
    maximumMs: entry.maximumMs,
    direction: entry.direction.trim().normalize('NFC'),
    ...(entry.delivery ? { delivery: entry.delivery } : {}),
  }
}

export function validateCinematicVoicePlan(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Cinematic voice plan must contain at least one dialogue line.')
  }

  const ids = new Set()
  const voiceBySpeaker = new Map()
  const normalized = []

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Cinematic voice plan contains a non-object entry.')
    }
    if (!ID_PATTERN.test(entry.id ?? '') || ids.has(entry.id)) {
      throw new Error(`Invalid or duplicate cinematic voice id: ${String(entry.id)}`)
    }
    if (!ID_PATTERN.test(entry.sceneId ?? '')) {
      throw new Error(`Invalid scene id for ${entry.id}: ${String(entry.sceneId)}`)
    }
    if (typeof entry.speaker !== 'string' || entry.speaker.trim().length < 2) {
      throw new Error(`Missing speaker for ${entry.id}.`)
    }
    if (typeof entry.text !== 'string' || entry.text.trim().length < 2) {
      throw new Error(`Missing dialogue text for ${entry.id}.`)
    }
    if (!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(entry.voiceName ?? '')) {
      throw new Error(`Invalid Google voice name for ${entry.id}.`)
    }
    if (
      !Number.isInteger(entry.maximumMs) ||
      entry.maximumMs < 800 ||
      entry.maximumMs > 12_000
    ) {
      throw new Error(`Invalid maximum duration for ${entry.id}.`)
    }
    if (typeof entry.direction !== 'string' || entry.direction.trim().length < 12) {
      throw new Error(`Missing performance direction for ${entry.id}.`)
    }
    if (entry.delivery !== undefined && !DELIVERY_PROFILES.has(entry.delivery)) {
      throw new Error(`Invalid delivery profile for ${entry.id}.`)
    }

    const assignedVoice = voiceBySpeaker.get(entry.speaker)
    if (assignedVoice && assignedVoice !== entry.voiceName) {
      throw new Error(
        `${entry.speaker} changes voice from ${assignedVoice} to ${entry.voiceName} at ${entry.id}.`,
      )
    }
    voiceBySpeaker.set(entry.speaker, entry.voiceName)
    ids.add(entry.id)
    normalized.push(normalizedPlanEntry(entry))
  }

  return normalized
}

export function cinematicPlanSha256(plan) {
  return sha256(JSON.stringify(validateCinematicVoicePlan(plan)))
}

export function cinematicLineContentSha256(
  line,
  {
    model = CINEMATIC_VOICE_MODEL,
    promptRevision = CINEMATIC_VOICE_PROMPT_REVISION,
  } = {},
) {
  const normalized = validateCinematicVoicePlan([line])[0]
  return sha256(
    JSON.stringify({
      ...normalized,
      model,
      promptRevision,
    }),
  )
}

export function inspectCinematicWav(audio, label) {
  if (
    !Buffer.isBuffer(audio) ||
    audio.length < 44 ||
    audio.toString('ascii', 0, 4) !== 'RIFF' ||
    audio.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error(`${label} is not a valid RIFF/WAVE asset.`)
  }

  const channelCount = audio.readUInt16LE(22)
  const sampleRate = audio.readUInt32LE(24)
  const byteRate = audio.readUInt32LE(28)
  const bitsPerSample = audio.readUInt16LE(34)
  const dataBytes = audio.readUInt32LE(40)
  if (
    channelCount !== 1 ||
    sampleRate !== 24_000 ||
    bitsPerSample !== 16 ||
    byteRate !== 48_000 ||
    dataBytes <= 0 ||
    dataBytes > audio.length - 44
  ) {
    throw new Error(`${label} must be mono 24kHz 16-bit PCM WAV audio.`)
  }
  return Math.round((dataBytes / byteRate) * 1_000)
}

export function cinematicManifestRevision(manifestBuffer) {
  return sha256(manifestBuffer).slice(0, 16)
}

export function verifyCinematicVoiceSet({
  manifest,
  manifestBuffer,
  plan,
  wavById,
  serviceWorkerRevision,
}) {
  const normalizedPlan = validateCinematicVoicePlan(plan)
  const planById = new Map(normalizedPlan.map((entry) => [entry.id, entry]))
  const allowedStatuses = new Set(['pending-generation', 'partial', 'ready'])

  if (!manifest || !allowedStatuses.has(manifest.status)) {
    throw new Error(`Unknown cinematic narration status: ${String(manifest?.status)}`)
  }
  if (
    manifest.provider !== CINEMATIC_VOICE_PROVIDER ||
    manifest.model !== CINEMATIC_VOICE_MODEL ||
    manifest.promptRevision !== CINEMATIC_VOICE_PROMPT_REVISION ||
    manifest.set !== CINEMATIC_VOICE_SET
  ) {
    throw new Error(
      'Cinematic narration manifest has an unexpected provider, model, prompt, or set.',
    )
  }
  if (
    manifest.expectedClipCount !== normalizedPlan.length ||
    manifest.planSha256 !== cinematicPlanSha256(normalizedPlan) ||
    !Array.isArray(manifest.clips)
  ) {
    throw new Error('Cinematic narration manifest does not match the current voice plan.')
  }
  if (!(wavById instanceof Map) || wavById.size !== manifest.clips.length) {
    throw new Error('Cinematic narration WAV count does not match the manifest.')
  }
  if (manifest.status === 'pending-generation' && manifest.clips.length !== 0) {
    throw new Error('Pending cinematic narration must not claim rendered clips.')
  }
  if (
    manifest.status === 'partial' &&
    (manifest.clips.length === 0 || manifest.clips.length >= normalizedPlan.length)
  ) {
    throw new Error('Partial cinematic narration has an invalid clip count.')
  }
  if (manifest.status === 'ready' && manifest.clips.length !== normalizedPlan.length) {
    throw new Error('Ready cinematic narration is missing one or more clips.')
  }

  const seen = new Set()
  for (const clip of manifest.clips) {
    const line = planById.get(clip?.id)
    if (!line || seen.has(clip.id)) {
      throw new Error(`Invalid or duplicate cinematic manifest clip: ${String(clip?.id)}`)
    }
    seen.add(clip.id)
    const wav = wavById.get(clip.id)
    if (!wav) throw new Error(`Cinematic narration is missing ${clip.id}.wav.`)

    const durationMs = inspectCinematicWav(wav, `${clip.id}.wav`)
    const expectedContentSha256 = cinematicLineContentSha256(line)
    const wavSha256 = sha256(wav)
    if (
      clip.sceneId !== line.sceneId ||
      clip.speaker !== line.speaker ||
      clip.voiceName !== line.voiceName ||
      clip.contentSha256 !== expectedContentSha256 ||
      clip.durationMs !== durationMs ||
      clip.durationMs > cinematicVoiceWindowMs(line) ||
      clip.bytes !== wav.length ||
      clip.sha256 !== wavSha256 ||
      !HASH_PATTERN.test(clip.sha256)
    ) {
      throw new Error(`${clip.id}.wav does not match its cinematic manifest metadata.`)
    }
  }

  const expectedRevision = cinematicManifestRevision(manifestBuffer)
  if (serviceWorkerRevision !== expectedRevision) {
    throw new Error(
      `Cinematic narration service-worker revision mismatch: expected ${expectedRevision}, found ${serviceWorkerRevision}.`,
    )
  }

  return manifest.clips.length
}
