import { describe, expect, it } from 'vitest'
import appSourceRaw from '../App.tsx?raw'
import screensSourceRaw from '../ui/Screens.tsx?raw'
import { CAMPAIGN_CINEMATICS } from '../story/cinematics'
import { shouldRecordCinematicSeen } from '../story/cinematicProgress'

const appSource = appSourceRaw.replace(/\r\n/g, '\n')
const screensSource = screensSourceRaw.replace(/\r\n/g, '\n')

describe('Combat Lab cinematic simulator integration', () => {
  it('exposes every campaign scene without a campaign-progress gate', () => {
    expect(CAMPAIGN_CINEMATICS).toHaveLength(11)
    expect(appSource).toContain('cinematics={CAMPAIGN_CINEMATICS}')
    expect(screensSource).toContain('cinematics.map((cinematic, index)')
    expect(screensSource).toContain(
      'All {cinematics.length} campaign scenes are unlocked',
    )
    expect(screensSource).not.toContain(
      'seenCinematics.includes(selectedCinematicId)',
    )
  })

  it('returns a Lab preview to the Lab rather than campaign or the Codex', () => {
    expect(appSource).toContain("showCinematic(cinematic.id, 'combat-lab')")
    expect(appSource).toContain(
      'type CinematicReturnScreen = CinematicProgressReturnScreen',
    )
    expect(appSource).toContain("cinematicReturnScreen === 'combat-lab'")
    expect(shouldRecordCinematicSeen('combat-lab')).toBe(false)
  })
})
