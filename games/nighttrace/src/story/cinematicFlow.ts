import type { RunMode } from '../shared/types'
import {
  CAMPAIGN_CINEMATICS,
  FINALE_CINEMATIC_ID,
  getCinematic,
  type CampaignCinematic,
} from './cinematics'

/**
 * Every sector owns one pre-run story reel. `nextLevelId` is the canonical
 * mapping, so the campaign never needs a second hard-coded scene table.
 */
export function cinematicBeforeCampaignLevel(
  levelId: number,
): CampaignCinematic | undefined {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > 10) return undefined
  return CAMPAIGN_CINEMATICS.find(
    (cinematic) => cinematic.nextLevelId === levelId,
  )
}

export function campaignCinematicAfterRun({
  runMode,
  victory,
  levelId,
}: {
  runMode: RunMode
  victory: boolean
  levelId: number
}): CampaignCinematic | undefined {
  if (runMode !== 'campaign' || !victory || levelId !== 10) return undefined
  return getCinematic(FINALE_CINEMATIC_ID)
}
