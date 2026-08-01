import { describe, expect, it } from 'vitest'
import generatorSourceRaw from '../../scripts/render-memory-voices.mjs?raw'
import wrapperSourceRaw from '../../scripts/render-memory-voices.ps1?raw'
import verifierSourceRaw from '../../scripts/verify-cinematic-audio.mjs?raw'
import integritySourceRaw from '../../scripts/memory-voice-integrity.mjs?raw'
import manifestSourceRaw from '../../public/assets/cinematics/audio/memories/manifest.json?raw'
import serviceWorkerSourceRaw from '../../public/sw.js?raw'
import { MEMORY_VOICE_PLAN } from './cinematics'

const generatorSource = generatorSourceRaw.replace(/\r\n/g, '\n')
const wrapperSource = wrapperSourceRaw.replace(/\r\n/g, '\n')
const verifierSource = verifierSourceRaw.replace(/\r\n/g, '\n')
const integritySource = integritySourceRaw.replace(/\r\n/g, '\n')
const serviceWorkerSource = serviceWorkerSourceRaw.replace(/\r\n/g, '\n')
const manifest = JSON.parse(manifestSourceRaw) as {
  status: 'pending-generation' | 'ready'
  provider: string
  model: string
  set: string
  expectedClipCount: number
  clips: Array<{
    id: string
    speaker: string
    voiceName: string
    durationMs: number
    bytes: number
    sha256: string
  }>
}

describe('Memory narration generation handoff', () => {
  it('assigns one independent take and an intentional voice to every Memory line', () => {
    expect(MEMORY_VOICE_PLAN).toHaveLength(22)
    expect(new Set(MEMORY_VOICE_PLAN.map((entry) => entry.id)).size).toBe(22)
    expect(new Set(MEMORY_VOICE_PLAN.map((entry) => entry.text)).size).toBe(22)

    expect(
      new Set(MEMORY_VOICE_PLAN.map((entry) => entry.voiceName)),
    ).toEqual(new Set(['Leda', 'Orus', 'Algenib', 'Rasalgethi']))
    expect(
      MEMORY_VOICE_PLAN.find(
        (entry) => entry.speaker === 'Cartographer echo',
      )?.voiceName,
    ).toBe('Rasalgethi')
    expect(
      MEMORY_VOICE_PLAN.find(
        (entry) => entry.speaker === 'Sun-Eater',
      )?.voiceName,
    ).toBe('Algenib')
  })

  it('keeps the checked-in manifest explicit while generation is pending or complete', () => {
    expect(manifest.provider).toBe('Google Gemini API')
    expect(manifest.model).toBe('gemini-3.1-flash-tts-preview')
    expect(manifest.set).toBe('memories-i-ix')
    expect(manifest.expectedClipCount).toBe(22)

    if (manifest.status === 'pending-generation') {
      expect(manifest.clips).toEqual([])
    } else {
      expect(manifest.clips).toHaveLength(22)
      expect(new Set(manifest.clips.map((clip) => clip.id)).size).toBe(22)
      for (const clip of manifest.clips) {
        expect(clip.durationMs).toBeGreaterThan(0)
        expect(clip.bytes).toBeGreaterThan(44)
        expect(clip.sha256).toMatch(/^[a-f0-9]{64}$/)
      }
    }
  })

  it('uses a resumable, duration-bounded generator without embedding credentials', () => {
    expect(generatorSource).toContain('process.env.GEMINI_API_KEY')
    expect(generatorSource).toContain("readFile(planPath, 'utf8')")
    expect(generatorSource).toContain("status: 'ready'")
    expect(generatorSource).toContain("createHash('sha256')")
    expect(generatorSource).toContain('existingDurationMs <= line.maximumMs')
    expect(generatorSource).toContain("`${destination}.partial`")
    expect(generatorSource).toContain('const maximumRateLimitRetries = 3')
    expect(generatorSource).toContain('const maximumWaitMs = 90_000')
    expect(generatorSource).toContain('AbortSignal.timeout(75_000)')
    expect(generatorSource).toContain('around 195 words per minute')
    expect(generatorSource).toContain('punctuation pauses under 60 milliseconds')
    expect(generatorSource).toContain('Google responded ${response.status}')
    expect(generatorSource).toContain('Completed WAVs remain reusable.')
    expect(generatorSource).toContain('updateServiceWorkerRevision(manifestContents)')
    expect(generatorSource).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/)
  })

  it('accepts the one-time key through a masked PowerShell prompt and clears it', () => {
    expect(wrapperSource).toContain("Read-Host 'Paste the temporary Google AI Studio API key' -AsSecureString")
    expect(wrapperSource).toContain('$env:GEMINI_API_KEY =')
    expect(wrapperSource).toContain('$maximumAttempts = 3')
    expect(wrapperSource).toContain('Completed WAVs are safe; resuming automatically')
    expect(wrapperSource).toContain('Remove-Item Env:GEMINI_API_KEY')
    expect(wrapperSource).toContain('ZeroFreeBSTR')
    expect(wrapperSource).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/)
  })

  it('pre-caches all generated clips only when the manifest is ready', () => {
    if (manifest.status === 'pending-generation') {
      expect(serviceWorkerSource).toContain("const MEMORY_VOICE_REVISION = 'pending'")
    } else {
      expect(serviceWorkerSource).toMatch(
        /const MEMORY_VOICE_REVISION = '[a-f0-9]{16}'/,
      )
    }
    expect(serviceWorkerSource).toContain('collectMemoryVoiceFiles(manifest)')
    expect(serviceWorkerSource).toContain("manifest?.status === 'pending-generation'")
    expect(serviceWorkerSource).toContain("manifest?.status !== 'ready'")
    expect(serviceWorkerSource).toContain('manifest.clips.length !== 22')
    expect(serviceWorkerSource).toContain('await precacheMemoryVoices(cache)')
    expect(serviceWorkerSource).toContain(
      '`assets/cinematics/audio/memories/${clip.id}.wav`',
    )
  })

  it('production verifier covers ready WAV integrity and explicit pending fallback', () => {
    expect(verifierSource).toContain("memoryManifest.status === 'pending-generation'")
    expect(verifierSource).toContain('subtitles remain the explicit fallback')
    expect(verifierSource).toContain("memoryManifest.status === 'ready'")
    expect(verifierSource).toContain('verifyReadyMemoryVoiceSet({')
    expect(integritySource).toContain("createHash('sha256').update(wav).digest('hex')")
    expect(integritySource).toContain('clip.durationMs !== durationMs')
    expect(integritySource).toContain('clip.bytes !== wav.length')
    expect(integritySource).toContain('service-worker revision mismatch')

  })
})
