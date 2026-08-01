import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  memoryManifestRevision,
  verifyReadyMemoryVoiceSet,
} from './memory-voice-integrity.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const plan = JSON.parse(
  readFileSync(resolve(projectRoot, 'src/story/memoryVoicePlan.json'), 'utf8'),
)
const checkedInManifest = JSON.parse(
  readFileSync(
    resolve(
      projectRoot,
      'public/assets/cinematics/audio/memories/manifest.json',
    ),
    'utf8',
  ),
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

describe('Memory narration production integrity', () => {
  it('executes the production verifier against the checked-in state', () => {
    const verifierPath = resolve(projectRoot, 'scripts/verify-cinematic-audio.mjs')
    const result = spawnSync(process.execPath, [verifierPath], {
      encoding: 'utf8',
    })

    expect(result.status, result.stderr).toBe(0)
    if (checkedInManifest.status === 'pending-generation') {
      expect(result.stdout).toContain(
        'Memory narration pending-generation: subtitles remain the explicit fallback',
      )
    } else {
      expect(result.stdout).toContain(
        'Verified 22 local Memory narration clips and service-worker precache mapping.',
      )
    }
  })

  it('accepts a complete synthetic 22-clip set and rejects altered audio', () => {
    const wavById = new Map(plan.map((entry) => [entry.id, makeTestWav()]))
    const readyManifest = {
      status: 'ready',
      provider: 'Google Gemini API',
      model: 'gemini-3.1-flash-tts-preview',
      set: 'memories-i-ix',
      expectedClipCount: plan.length,
      clips: plan.map((entry) => {
        const wav = wavById.get(entry.id)
        return {
          id: entry.id,
          speaker: entry.speaker,
          voiceName: entry.voiceName,
          durationMs: 100,
          bytes: wav.length,
          sha256: createHash('sha256').update(wav).digest('hex'),
        }
      }),
    }
    const manifestBuffer = Buffer.from(`${JSON.stringify(readyManifest)}\n`)
    const revision = memoryManifestRevision(manifestBuffer)

    expect(
      verifyReadyMemoryVoiceSet({
        manifest: readyManifest,
        manifestBuffer,
        plan,
        wavById,
        serviceWorkerRevision: revision,
      }),
    ).toBe(22)

    const alteredWavs = new Map(wavById)
    const first = plan[0]
    const altered = Buffer.from(alteredWavs.get(first.id))
    altered[altered.length - 1] ^= 0xff
    alteredWavs.set(first.id, altered)
    expect(() =>
      verifyReadyMemoryVoiceSet({
        manifest: readyManifest,
        manifestBuffer,
        plan,
        wavById: alteredWavs,
        serviceWorkerRevision: revision,
      }),
    ).toThrow(`${first.id}.wav does not match its ready manifest metadata.`)
  })
})
