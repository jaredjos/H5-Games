import { describe, expect, it } from 'vitest'
import appSourceRaw from '../App.tsx?raw'

const appSource = appSourceRaw.replace(/\r\n/g, '\n')

describe('campaign cinematic integration', () => {
  it('queues a pre-run reel for every campaign start and uses Skip completion to launch', () => {
    expect(appSource).toContain('const cinematic = cinematicBeforeCampaignLevel(safeLevelId)')
    expect(appSource).toContain("showCinematic(cinematic.id, 'campaign', () => launchRun(runConfig))")
    expect(appSource).toContain('const pendingAction = pendingCinematicActionRef.current')
    expect(appSource).toContain('pendingAction()')
  })

  it('routes campaign retries through the same cinematic gate', () => {
    expect(appSource).toContain("if (activeRun.mode === 'campaign')")
    expect(appSource).toContain('startLevel(activeRun.arenaLevelId)')
  })

  it('does not suppress reels using seen history or the old setting', () => {
    expect(appSource).not.toContain('shouldPlayCampaignIntro')
    expect(appSource).not.toContain('isFirstCampaignClear')
    expect(appSource).not.toContain('firstClearCinematic')
  })
})
