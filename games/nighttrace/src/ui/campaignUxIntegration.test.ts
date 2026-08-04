import { describe, expect, it } from 'vitest'
import appSourceRaw from '../App.tsx?raw'
import screensSourceRaw from './Screens.tsx?raw'

const appSource = appSourceRaw.replace(/\r\n/g, '\n')
const screensSource = screensSourceRaw.replace(/\r\n/g, '\n')

describe('campaign UX integration', () => {
  it('offers Astrarium after every outcome and keeps the first-visit nudge persistent', () => {
    expect(appSource).toContain('showAstrariumNudge={!save.story.astrariumVisited}')
    expect(appSource).toContain("onAstrarium={() => navigate('astrarium')}")
    expect(appSource).toContain("destination === 'astrarium' && !save.story.astrariumVisited")
    expect(screensSource).toContain('<strong>Visit Astrarium</strong>')
    expect(screensSource).toContain('Your first persistent upgrade awaits')

    const astrariumAction = screensSource.indexOf('className={`results-astrarium')
    const resultActions = screensSource.indexOf('className="results-actions"', astrariumAction)
    expect(astrariumAction).toBeGreaterThan(0)
    expect(resultActions).toBeGreaterThan(astrariumAction)
  })

  it('uses the same campaign start label and handler for desktop and mobile', () => {
    expect(screensSource).toContain('const startLabel = isUnlocked')
    expect(screensSource).toContain('const startSelectedLevel = () => onStart(selected.id)')
    expect(screensSource).toContain('campaign-start campaign-start--detail')
    expect(screensSource).toContain('campaign-start campaign-start--mobile')
    expect(screensSource.match(/onClick={startSelectedLevel}/g)).toHaveLength(2)
  })

  it('renders the mobile action outside the scrollable stage rail', () => {
    const stageRail = screensSource.indexOf('<PanelFrame className="stage-rail">')
    const stageRailClose = screensSource.indexOf('</PanelFrame>', stageRail)
    const mobileAction = screensSource.indexOf(
      'className="campaign-start campaign-start--mobile"',
      stageRail,
    )

    expect(stageRail).toBeGreaterThan(0)
    expect(stageRailClose).toBeGreaterThan(stageRail)
    expect(mobileAction).toBeGreaterThan(stageRailClose)
  })
})
