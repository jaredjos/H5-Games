import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CINEMATIC_VOICE_HEADROOM_MS,
  cinematicVoiceWindowMs,
  validateCinematicVoicePlan,
} from './cinematic-voice-integrity.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const plan = validateCinematicVoicePlan(
  JSON.parse(
    readFileSync(resolve(projectRoot, 'src/story/cinematicVoicePlan.json'), 'utf8'),
  ),
)
const byId = new Map(plan.map((line) => [line.id, line]))

describe('Cinematic voice timing windows', () => {
  it('keeps expressive lines on the same bounded cadence as the accepted campaign', () => {
    const first = byId.get('intro-star-01')
    const second = byId.get('intro-star-02')
    const standard = byId.get('intro-star-03')

    expect(cinematicVoiceWindowMs(first)).toBe(7_200)
    expect(cinematicVoiceWindowMs(second)).toBe(7_800)
    expect(cinematicVoiceWindowMs(standard)).toBe(
      standard.maximumMs + CINEMATIC_VOICE_HEADROOM_MS,
    )
  })
})
