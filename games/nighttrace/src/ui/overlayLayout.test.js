import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import appSource from '../App.tsx?raw'
import gameUiSource from './GameUI.tsx?raw'

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

const rule = (selector, source = styles) => {
  const start = source.indexOf(selector)
  expect(start, selector).toBeGreaterThanOrEqual(0)
  const open = source.indexOf('{', start)
  const close = source.indexOf('}', open)
  expect(open, selector).toBeGreaterThan(start)
  expect(close, selector).toBeGreaterThan(open)
  return source.slice(open + 1, close)
}

describe('modal centering contracts', () => {
  it('centers upgrade, pause, revive, and encounter content through one safe-area shell', () => {
    const shell = rule('.upgrade-overlay,\n.pause-overlay')
    const content = rule('.upgrade-overlay__content,\n.pause-overlay__content')

    expect(shell).toContain('align-items: center')
    expect(shell).toContain('padding: var(--overlay-safe-block) var(--overlay-safe-inline)')
    expect(shell).toContain('calc(var(--safe-left) + 12px)')
    expect(shell).toContain('calc(var(--safe-right) + 12px)')
    expect(shell).toContain('calc(var(--safe-top) + 12px)')
    expect(shell).toContain('calc(var(--safe-bottom) + 12px)')
    expect(content).toContain('justify-items: center')
    expect(content).toContain('width: 100%')
    expect(content).toContain('margin-block: auto')
    expect(content).toContain('text-align: center')
  })

  it('keeps every gameplay dialog inside the centered content wrapper', () => {
    expect(gameUiSource.match(/className="upgrade-overlay__content"/g)).toHaveLength(1)
    expect(gameUiSource.match(/className="pause-overlay__content"/g)).toHaveLength(3)
    expect(gameUiSource.match(/className="pause-panel(?: [^"]+)?"/g)).toHaveLength(3)
    expect(gameUiSource).toContain('className="pause-panel revive-panel"')
  })

  it('uses equal left and right safe-area gutters in mobile landscape', () => {
    const mobileLandscapeStart = styles.indexOf(
      '@media (max-width: 900px) and (orientation: landscape)',
    )
    expect(mobileLandscapeStart).toBeGreaterThanOrEqual(0)
    const mobileLandscape = styles.slice(mobileLandscapeStart)
    const overlay = rule('.upgrade-overlay', mobileLandscape)
    const heading = rule('.upgrade-heading h1', mobileLandscape)

    expect(overlay).toContain('calc(var(--safe-left) + 8px)')
    expect(overlay).toContain('calc(var(--safe-right) + 8px)')
    expect(overlay).toContain('padding: var(--overlay-safe-block) var(--overlay-safe-inline)')
    expect(overlay).toContain('overflow-y: auto')
    expect(heading).toContain('text-align: center')
  })

  it('keeps the rotate dialog and toast geometrically centered', () => {
    const portraitStart = styles.indexOf(
      '@media (max-width: 900px) and (orientation: portrait)',
    )
    expect(portraitStart).toBeGreaterThanOrEqual(0)
    const portrait = styles.slice(portraitStart)
    const landscapeGate = rule('.landscape-gate', portrait)
    const toast = rule('.toast-region')

    expect(landscapeGate).toContain('place-content: center')
    expect(landscapeGate).toContain('calc(var(--safe-left) + 22px)')
    expect(landscapeGate).toContain('calc(var(--safe-right) + 22px)')
    expect(landscapeGate).toContain('var(--landscape-gate-safe-inline)')
    expect(toast).toContain('left: 50%')
    expect(toast).toContain('text-align: center')
    expect(appSource).toContain('className="landscape-gate"')
    expect(appSource).toContain('className={`toast-region${toast ? \' is-visible\' : \'\'}`}')
  })
})
