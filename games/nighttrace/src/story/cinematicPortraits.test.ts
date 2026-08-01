import { describe, expect, it } from 'vitest'
import { CAMPAIGN_CINEMATICS, CINEMATIC_VOICE_PLAN } from './cinematics'
import {
  getCinematicPortrait,
  hasAuthoredCinematicPortraitFrame,
} from './cinematicPortraits'

describe('cinematic portraits', () => {
  it('assigns a valid expression frame and portrait asset to every story line', () => {
    for (const cinematic of CAMPAIGN_CINEMATICS) {
      for (const line of cinematic.lines) {
        const portrait = getCinematicPortrait(line)
        expect(portrait.asset).toMatch(
          /^assets\/cinematics\/portraits\/.+-expressions\.webp$/,
        )
        expect(portrait.frame).toBeGreaterThanOrEqual(0)
        expect(portrait.frame).toBeLessThanOrEqual(3)
        expect(portrait.label).toContain(line.speaker)
      }
    }
  })

  it('uses distinct emotional beats during the finale', () => {
    const finale = CAMPAIGN_CINEMATICS.find(
      (cinematic) => cinematic.kind === 'finale',
    )
    expect(finale).toBeDefined()

    const frames = new Set(
      finale?.lines.map((line) => getCinematicPortrait(line).frame),
    )
    expect(frames.size).toBeGreaterThanOrEqual(3)
  })

  it('authors an intentional expression for every expanded campaign line', () => {
    for (const line of CINEMATIC_VOICE_PLAN) {
      expect(
        hasAuthoredCinematicPortraitFrame(line.id),
        `${line.id} should not fall back to a generic expression`,
      ).toBe(true)
    }
  })

  it('uses the full emotional range of the established hero and star sheets', () => {
    const framesBySpeaker = new Map<string, Set<number>>()

    for (const line of CINEMATIC_VOICE_PLAN) {
      const frames = framesBySpeaker.get(line.speaker) ?? new Set<number>()
      frames.add(getCinematicPortrait(line).frame)
      framesBySpeaker.set(line.speaker, frames)
    }

    expect(framesBySpeaker.get('Bearer')).toEqual(new Set([0, 1, 2, 3]))
    expect(framesBySpeaker.get('Last Star')).toEqual(new Set([0, 1, 2, 3]))
    expect(framesBySpeaker.get('Sun-Eater')?.size).toBeGreaterThanOrEqual(3)
    expect(framesBySpeaker.get('Cartographer echo')?.size).toBeGreaterThanOrEqual(
      3,
    )
  })

  it('matches pivotal dialogue beats to the intended emotions', () => {
    const lines = new Map(CINEMATIC_VOICE_PLAN.map((line) => [line.id, line]))
    const frame = (id: string) => {
      const line = lines.get(id)
      expect(line).toBeDefined()
      return getCinematicPortrait(line!).frame
    }

    expect(frame('interlude-04-star-02')).toBe(2)
    expect(frame('interlude-08-bearer-02')).toBe(1)
    expect(frame('interlude-09-cartographer-02')).toBe(2)
    expect(frame('finale-bearer-04')).toBe(2)
    expect(frame('finale-star-06')).toBe(3)
    expect(frame('finale-sun-eater-03')).toBe(2)
  })
})
