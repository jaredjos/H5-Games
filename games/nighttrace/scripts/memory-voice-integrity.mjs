import { createHash } from 'node:crypto'

export function inspectMemoryWav(audio, label) {
  if (
    audio.length < 44 ||
    audio.toString('ascii', 0, 4) !== 'RIFF' ||
    audio.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error(`${label} is not a valid RIFF/WAVE asset.`)
  }
  const byteRate = audio.readUInt32LE(28)
  const dataBytes = audio.readUInt32LE(40)
  if (byteRate <= 0 || dataBytes <= 0 || dataBytes > audio.length - 44) {
    throw new Error(`${label} has invalid WAV metadata.`)
  }
  return Math.round((dataBytes / byteRate) * 1_000)
}

export function memoryManifestRevision(manifestBuffer) {
  return createHash('sha256')
    .update(manifestBuffer)
    .digest('hex')
    .slice(0, 16)
}

export function verifyReadyMemoryVoiceSet({
  manifest,
  manifestBuffer,
  plan,
  wavById,
  serviceWorkerRevision,
}) {
  if (manifest?.status !== 'ready') {
    throw new Error('Memory narration manifest is not ready.')
  }
  if (
    !Array.isArray(plan) ||
    !Array.isArray(manifest.clips) ||
    manifest.expectedClipCount !== plan.length ||
    manifest.clips.length !== plan.length ||
    wavById.size !== plan.length
  ) {
    throw new Error('Ready Memory narration set has an invalid clip count.')
  }

  const clipsById = new Map()
  for (const clip of manifest.clips) {
    if (!clip?.id || clipsById.has(clip.id)) {
      throw new Error(`Invalid or duplicate Memory manifest clip: ${String(clip?.id)}`)
    }
    clipsById.set(clip.id, clip)
  }

  for (const planEntry of plan) {
    const clip = clipsById.get(planEntry.id)
    const wav = wavById.get(planEntry.id)
    if (!clip || !wav) {
      throw new Error(`Ready Memory narration is missing ${planEntry.id}.wav.`)
    }
    if (
      clip.speaker !== planEntry.speaker ||
      clip.voiceName !== planEntry.voiceName
    ) {
      throw new Error(`${planEntry.id}.wav has mismatched speaker attribution.`)
    }

    const durationMs = inspectMemoryWav(wav, `${planEntry.id}.wav`)
    const sha256 = createHash('sha256').update(wav).digest('hex')
    if (
      clip.durationMs !== durationMs ||
      clip.durationMs > planEntry.maximumMs ||
      clip.bytes !== wav.length ||
      clip.sha256 !== sha256
    ) {
      throw new Error(
        `${planEntry.id}.wav does not match its ready manifest metadata.`,
      )
    }
  }

  const expectedRevision = memoryManifestRevision(manifestBuffer)
  if (serviceWorkerRevision !== expectedRevision) {
    throw new Error(
      `Memory narration service-worker revision mismatch: expected ${expectedRevision}, found ${serviceWorkerRevision}.`,
    )
  }

  return plan.length
}
