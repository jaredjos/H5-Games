import { describe, expect, it } from 'vitest'
import {
  campaignCinematicAfterRun,
  cinematicBeforeCampaignLevel,
} from './cinematicFlow'
import { FINALE_CINEMATIC_ID, INTRO_CINEMATIC_ID } from './cinematics'

describe('campaign cinematic routing', () => {
  it('maps one story reel to every campaign sector', () => {
    expect(cinematicBeforeCampaignLevel(1)?.id).toBe(INTRO_CINEMATIC_ID)
    expect(
      Array.from({ length: 10 }, (_, index) =>
        cinematicBeforeCampaignLevel(index + 1)?.nextLevelId,
      ),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(cinematicBeforeCampaignLevel(0)).toBeUndefined()
    expect(cinematicBeforeCampaignLevel(11)).toBeUndefined()
    expect(cinematicBeforeCampaignLevel(1.5)).toBeUndefined()
  })

  it('reserves the post-run cinematic for the level-ten finale', () => {
    expect(campaignCinematicAfterRun({
      runMode: 'campaign',
      victory: true,
      levelId: 1,
    })).toBeUndefined()
    expect(campaignCinematicAfterRun({
      runMode: 'campaign',
      victory: true,
      levelId: 10,
    })?.id).toBe(FINALE_CINEMATIC_ID)
  })

  it('leaves failures, Boss Trials, and Combat Lab without post-run story', () => {
    for (const sample of [
      { runMode: 'campaign' as const, victory: false },
      { runMode: 'boss-trial' as const, victory: true },
      { runMode: 'combat-lab' as const, victory: true },
    ]) {
      expect(campaignCinematicAfterRun({
        ...sample,
        levelId: 10,
      })).toBeUndefined()
    }
  })

  it('replays the finale after repeat level-ten victories', () => {
    expect(campaignCinematicAfterRun({
      runMode: 'campaign',
      victory: true,
      levelId: 10,
    })?.id).toBe(FINALE_CINEMATIC_ID)
  })
})
