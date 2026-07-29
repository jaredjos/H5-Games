import { describe, expect, it } from 'vitest'
import reviewSource from '../../public/review/hostile-boundary/index.html?raw'

describe('hostile boundary approval review', () => {
  it('keeps the three requested hostile-warning studies isolated from live combat', () => {
    expect(reviewSource).toContain('data-study="field"')
    expect(reviewSource).toContain('data-study="lane"')
    expect(reviewSource).toContain('data-study="horde"')
    expect(reviewSource).toContain('Boss field')
    expect(reviewSource).toContain('Boss lane + destination')
    expect(reviewSource).toContain('Elite-horde field')
    expect(reviewSource).not.toContain('GameCanvas')
  })

  it('reuses production arena, hero, boss, and horde assets', () => {
    expect(reviewSource).toContain(
      'url("../../assets/first-beacon-arena.webp")',
    )
    expect(reviewSource).toContain(
      'url("../../assets/hero-animations/hero-fire-runtime.webp")',
    )
    expect(reviewSource).toContain(
      'url("../../assets/boss-animations/boss-motion-atlas-a.webp")',
    )
    expect(reviewSource).toContain(
      'url("../../assets/enemy-animations/enemy-motion-atlas-b.webp")',
    )
  })

  it('uses animated broken material spray rather than diagrammatic primitives', () => {
    expect(reviewSource).toContain('drawPerimeterSpray')
    expect(reviewSource).toContain('drawBrokenLaneSpray')
    expect(reviewSource).toContain('drawMotes')
    expect(reviewSource).toContain('requestAnimationFrame(render)')
    expect(reviewSource).not.toContain('setLineDash')
    expect(reviewSource).not.toContain('strokeRect')
    expect(reviewSource).not.toContain('repeating-radial-gradient')
    expect(reviewSource).not.toContain('conic-gradient')
  })

  it('exposes a motion control and mobile-landscape layout', () => {
    expect(reviewSource).toContain('Pause motion')
    expect(reviewSource).toContain('prefers-reduced-motion')
    expect(reviewSource).toContain(
      '@media (max-width: 920px) and (orientation: landscape)',
    )
    expect(reviewSource).toContain('env(safe-area-inset-left)')
    expect(reviewSource).toContain('env(safe-area-inset-right)')
  })
})
