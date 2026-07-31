import { describe, expect, it } from 'vitest'
import { CAMPAIGN_CINEMATICS } from './cinematics'
import { getCinematicPortrait } from './cinematicPortraits'

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
})
