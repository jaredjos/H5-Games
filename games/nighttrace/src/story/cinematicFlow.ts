import type { GameSettings, RunMode } from '../shared/types'
import {
  INTRO_CINEMATIC_ID,
  cinematicForFirstClear,
  type CampaignCinematic,
} from './cinematics'

type CinematicMode = GameSettings['cinematics']

export function shouldPlayCampaignIntro({
  mode,
  seenCinematics,
}: {
  mode: CinematicMode
  seenCinematics: readonly string[]
}) {
  if (mode === 'off') return false
  if (mode === 'always') return true
  return !seenCinematics.includes(INTRO_CINEMATIC_ID)
}

export function campaignCinematicAfterRun({
  runMode,
  victory,
  levelId,
  isFirstClear,
  mode,
  seenCinematics,
}: {
  runMode: RunMode
  victory: boolean
  levelId: number
  isFirstClear: boolean
  mode: CinematicMode
  seenCinematics: readonly string[]
}): CampaignCinematic | undefined {
  if (runMode !== 'campaign' || !victory || mode === 'off') return undefined
  if (!isFirstClear && mode !== 'always') return undefined

  const cinematic = cinematicForFirstClear(levelId)
  if (!cinematic) return undefined
  if (mode === 'first-clear' && seenCinematics.includes(cinematic.id)) return undefined
  return cinematic
}
