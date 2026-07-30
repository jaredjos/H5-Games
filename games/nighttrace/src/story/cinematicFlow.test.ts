import { describe, expect, it } from 'vitest'
import {
  campaignCinematicAfterRun,
  shouldPlayCampaignIntro,
} from './cinematicFlow'
import { FINALE_CINEMATIC_ID, INTRO_CINEMATIC_ID } from './cinematics'

describe('campaign cinematic routing', () => {
  it('plays the prologue once by default, always on request, and never when disabled', () => {
    expect(shouldPlayCampaignIntro({
      mode: 'first-clear',
      seenCinematics: [],
    })).toBe(true)
    expect(shouldPlayCampaignIntro({
      mode: 'first-clear',
      seenCinematics: [INTRO_CINEMATIC_ID],
    })).toBe(false)
    expect(shouldPlayCampaignIntro({
      mode: 'always',
      seenCinematics: [INTRO_CINEMATIC_ID],
    })).toBe(true)
    expect(shouldPlayCampaignIntro({
      mode: 'off',
      seenCinematics: [],
    })).toBe(false)
  })

  it('routes first campaign victories through memories and level ten through the finale', () => {
    expect(campaignCinematicAfterRun({
      runMode: 'campaign',
      victory: true,
      levelId: 1,
      isFirstClear: true,
      mode: 'first-clear',
      seenCinematics: [],
    })?.id).toBe('interlude-01-the-road-remembers')
    expect(campaignCinematicAfterRun({
      runMode: 'campaign',
      victory: true,
      levelId: 10,
      isFirstClear: true,
      mode: 'first-clear',
      seenCinematics: [],
    })?.id).toBe(FINALE_CINEMATIC_ID)
  })

  it('leaves failures, repeats, Boss Trials, Combat Lab, and disabled scenes untouched', () => {
    for (const sample of [
      { runMode: 'campaign' as const, victory: false, isFirstClear: true, mode: 'first-clear' as const },
      { runMode: 'campaign' as const, victory: true, isFirstClear: false, mode: 'first-clear' as const },
      { runMode: 'boss-trial' as const, victory: true, isFirstClear: true, mode: 'first-clear' as const },
      { runMode: 'combat-lab' as const, victory: true, isFirstClear: true, mode: 'first-clear' as const },
      { runMode: 'campaign' as const, victory: true, isFirstClear: true, mode: 'off' as const },
    ]) {
      expect(campaignCinematicAfterRun({
        ...sample,
        levelId: 3,
        seenCinematics: [],
      })).toBeUndefined()
    }
  })

  it('allows explicit always mode to replay campaign memories but nothing outside campaign', () => {
    expect(campaignCinematicAfterRun({
      runMode: 'campaign',
      victory: true,
      levelId: 4,
      isFirstClear: false,
      mode: 'always',
      seenCinematics: ['interlude-04-the-reflection-that-waits'],
    })?.id).toBe('interlude-04-the-reflection-that-waits')
    expect(campaignCinematicAfterRun({
      runMode: 'boss-trial',
      victory: true,
      levelId: 4,
      isFirstClear: false,
      mode: 'always',
      seenCinematics: [],
    })).toBeUndefined()
  })
})
