import { describe, expect, it } from 'vitest'
import generatorSourceRaw from '../../scripts/render-cinematic-voices.mjs?raw'
import wrapperSourceRaw from '../../scripts/render-cinematic-voices.ps1?raw'
import verifierSourceRaw from '../../scripts/verify-cinematic-audio.mjs?raw'
import integritySourceRaw from '../../scripts/cinematic-voice-integrity.mjs?raw'
import manifestSourceRaw from '../../public/assets/cinematics/audio/campaign/manifest.json?raw'
import serviceWorkerSourceRaw from '../../public/sw.js?raw'
import { CINEMATIC_VOICE_PLAN } from './cinematics'

const generatorSource = generatorSourceRaw.replace(/\r\n/g, '\n')
const wrapperSource = wrapperSourceRaw.replace(/\r\n/g, '\n')
const verifierSource = verifierSourceRaw.replace(/\r\n/g, '\n')
const integritySource = integritySourceRaw.replace(/\r\n/g, '\n')
const serviceWorkerSource = serviceWorkerSourceRaw.replace(/\r\n/g, '\n')
const manifest = JSON.parse(manifestSourceRaw) as {
  status: 'pending-generation' | 'partial' | 'ready'
  provider: string
  model: string
  set: string
  expectedClipCount: number
  planSha256: string
  clips: Array<{
    id: string
    sceneId: string
    speaker: string
    voiceName: string
    contentSha256: string
    durationMs: number
    bytes: number
    sha256: string
  }>
}

describe('Unified campaign narration generation handoff', () => {
  it('assigns an independent local take and a stable actor voice to every story line', () => {
    expect(CINEMATIC_VOICE_PLAN.length).toBeGreaterThan(50)
    expect(new Set(CINEMATIC_VOICE_PLAN.map((entry) => entry.id)).size)
      .toBe(CINEMATIC_VOICE_PLAN.length)
    expect(new Set(CINEMATIC_VOICE_PLAN.map((entry) => entry.sceneId)).size)
      .toBe(11)

    const voiceBySpeaker = new Map<string, string>()
    for (const line of CINEMATIC_VOICE_PLAN) {
      expect(line.direction.length).toBeGreaterThan(12)
      const existing = voiceBySpeaker.get(line.speaker)
      if (existing) expect(line.voiceName).toBe(existing)
      voiceBySpeaker.set(line.speaker, line.voiceName)
    }
    expect(voiceBySpeaker.get('Last Star')).toBe('Aoede')
    expect(voiceBySpeaker.get('Bearer')).toBe('Orus')
    expect(voiceBySpeaker.get('Sun-Eater')).toBe('Algenib')
    expect(voiceBySpeaker.get('Cartographer echo')).toBe('Rasalgethi')
  })

  it('keeps the checked-in manifest explicit while generation is pending, partial or complete', () => {
    expect(manifest.provider).toBe('Google Gemini API')
    expect(manifest.model).toBe('gemini-3.1-flash-tts-preview')
    expect(manifest.set).toBe('campaign')
    expect(manifest.expectedClipCount).toBe(CINEMATIC_VOICE_PLAN.length)
    expect(manifest.planSha256).toMatch(/^[a-f0-9]{64}$/)

    if (manifest.status === 'pending-generation') {
      expect(manifest.clips).toEqual([])
    } else if (manifest.status === 'partial') {
      expect(manifest.clips.length).toBeGreaterThan(0)
      expect(manifest.clips.length).toBeLessThan(CINEMATIC_VOICE_PLAN.length)
    } else {
      expect(manifest.clips).toHaveLength(CINEMATIC_VOICE_PLAN.length)
    }
  })

  it('supports hash-aware reuse, scene selection, dry runs, forced renders and resumable checkpoints', () => {
    expect(generatorSource).toContain('process.env.GEMINI_API_KEY')
    expect(generatorSource).toContain("'--dry-run'")
    expect(generatorSource).toContain("'--force'")
    expect(generatorSource).toContain("'--scene'")
    expect(generatorSource).toContain('cinematicLineContentSha256(line)')
    expect(generatorSource).toContain('reusableClip(line, priorClipById.get(line.id))')
    expect(generatorSource).toContain('await writeCheckpoint(plan, clipById)')
    expect(generatorSource).toContain('const maximumRequestRetries = 4')
    expect(generatorSource).toContain('AbortSignal.timeout(requestTimeoutMs)')
    expect(generatorSource).toContain("response.status === 429 || response.status >= 500")
    expect(generatorSource).toContain('Completed WAVs remain reusable.')
    expect(generatorSource).toContain('const fileReplaceRetries = 8')
    expect(generatorSource).toContain('replaceGeneratedFile(manifestPath, contents)')
    expect(generatorSource).toContain("['EPERM', 'EACCES', 'EBUSY', 'EEXIST']")
    expect(generatorSource).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/)
  })

  it('accepts a one-time key through a masked PowerShell prompt and clears it', () => {
    expect(wrapperSource).toContain("Read-Host 'Paste the temporary Google AI Studio API key' -AsSecureString")
    expect(wrapperSource).toContain('$env:GEMINI_API_KEY = $plainApiKey')
    expect(wrapperSource).toContain('Remove-Item Env:GEMINI_API_KEY')
    expect(wrapperSource).toContain('ZeroFreeBSTR')
    expect(wrapperSource).toContain("$nodeArguments += '--dry-run'")
    expect(wrapperSource).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/)
  })

  it('dynamically precaches only same-origin campaign clips and rejects external narration', () => {
    expect(serviceWorkerSource).toContain('collectCinematicVoiceFiles(manifest)')
    expect(serviceWorkerSource).toContain('manifest.expectedClipCount')
    expect(serviceWorkerSource).toContain('await precacheCinematicVoices(cache)')
    expect(serviceWorkerSource).toContain(
      '`assets/cinematics/audio/campaign/${clip.id}.wav`',
    )
    expect(serviceWorkerSource).not.toContain('assets/cinematics/audio/last-star/')
    expect(serviceWorkerSource).not.toContain('assets/cinematics/audio/memories/')
    expect(verifierSource).toContain('External or legacy narration is forbidden')
    expect(verifierSource).toContain('/https?:\\/\\//i.test(cinematicSource)')
    expect(integritySource).toContain('clip.contentSha256 !== expectedContentSha256')
    expect(integritySource).toContain('service-worker revision mismatch')
  })
})
