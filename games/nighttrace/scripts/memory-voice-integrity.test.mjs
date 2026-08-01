import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_VOICE_MODEL,
  CINEMATIC_VOICE_PROMPT_REVISION,
  CINEMATIC_VOICE_PROVIDER,
  CINEMATIC_VOICE_SET,
  CINEMATIC_VOICE_HEADROOM_MS,
  cinematicLineContentSha256,
  cinematicManifestRevision,
  cinematicPlanSha256,
  cinematicVoiceWindowMs,
  verifyCinematicVoiceSet,
} from './cinematic-voice-integrity.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const plan = JSON.parse(
  readFileSync(resolve(projectRoot, 'src/story/cinematicVoicePlan.json'), 'utf8'),
)

function makeTestWav(durationMs = 100) {
  const sampleRate = 24_000
  const pcm = Buffer.alloc(Math.round(sampleRate * 2 * (durationMs / 1_000)), 1)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

function readyFixture() {
  const wavById = new Map(plan.map((entry) => [entry.id, makeTestWav()]))
  const manifest = {
    status: 'ready',
    provider: CINEMATIC_VOICE_PROVIDER,
    model: CINEMATIC_VOICE_MODEL,
    promptRevision: CINEMATIC_VOICE_PROMPT_REVISION,
    set: CINEMATIC_VOICE_SET,
    expectedClipCount: plan.length,
    planSha256: cinematicPlanSha256(plan),
    generatedAt: '2026-08-01T00:00:00.000Z',
    clips: plan.map((entry) => {
      const wav = wavById.get(entry.id)
      return {
        id: entry.id,
        sceneId: entry.sceneId,
        speaker: entry.speaker,
        voiceName: entry.voiceName,
        contentSha256: cinematicLineContentSha256(entry),
        durationMs: 100,
        bytes: wav.length,
        sha256: createHash('sha256').update(wav).digest('hex'),
      }
    }),
  }
  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest)}\n`)
  return { manifest, manifestBuffer, wavById }
}

describe('Unified cinematic narration production integrity', () => {
  it('provides deterministic natural-delivery headroom without changing authored timing hashes', () => {
    const line = plan[0]
    expect(cinematicVoiceWindowMs(line)).toBe(line.maximumMs + CINEMATIC_VOICE_HEADROOM_MS)
    expect(cinematicLineContentSha256(line)).toBe(cinematicLineContentSha256({ ...line }))
  })

  it('accepts a complete synthetic campaign and rejects altered audio', () => {
    const { manifest, manifestBuffer, wavById } = readyFixture()
    const revision = cinematicManifestRevision(manifestBuffer)

    expect(
      verifyCinematicVoiceSet({
        manifest,
        manifestBuffer,
        plan,
        wavById,
        serviceWorkerRevision: revision,
      }),
    ).toBe(plan.length)

    const alteredWavs = new Map(wavById)
    const first = plan[0]
    const altered = Buffer.from(alteredWavs.get(first.id))
    altered[altered.length - 1] ^= 0xff
    alteredWavs.set(first.id, altered)
    expect(() =>
      verifyCinematicVoiceSet({
        manifest,
        manifestBuffer,
        plan,
        wavById: alteredWavs,
        serviceWorkerRevision: revision,
      }),
    ).toThrow(`${first.id}.wav does not match its cinematic manifest metadata.`)
  })

  it('invalidates reuse when dialogue, direction, actor, timing, model or prompt changes', () => {
    const line = plan[0]
    const baseline = cinematicLineContentSha256(line)
    expect(cinematicLineContentSha256({ ...line, text: `${line.text} Again.` }))
      .not.toBe(baseline)
    expect(cinematicLineContentSha256({ ...line, direction: `${line.direction} Faster.` }))
      .not.toBe(baseline)
    expect(cinematicLineContentSha256({ ...line, voiceName: 'Leda' }))
      .not.toBe(baseline)
    expect(cinematicLineContentSha256({ ...line, maximumMs: line.maximumMs + 100 }))
      .not.toBe(baseline)
    expect(cinematicLineContentSha256(line, { model: 'future-model' }))
      .not.toBe(baseline)
    expect(cinematicLineContentSha256(line, { promptRevision: 'future-prompt' }))
      .not.toBe(baseline)
  })

  it('accepts an explicit pending manifest with no WAV claims', () => {
    const manifest = {
      status: 'pending-generation',
      provider: CINEMATIC_VOICE_PROVIDER,
      model: CINEMATIC_VOICE_MODEL,
      promptRevision: CINEMATIC_VOICE_PROMPT_REVISION,
      set: CINEMATIC_VOICE_SET,
      expectedClipCount: plan.length,
      planSha256: cinematicPlanSha256(plan),
      generatedAt: null,
      clips: [],
    }
    const manifestBuffer = Buffer.from(`${JSON.stringify(manifest)}\n`)
    expect(
      verifyCinematicVoiceSet({
        manifest,
        manifestBuffer,
        plan,
        wavById: new Map(),
        serviceWorkerRevision: cinematicManifestRevision(manifestBuffer),
      }),
    ).toBe(0)
  })
})
