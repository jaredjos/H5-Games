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
      'data-atlas-src="../../assets/hero-animations/hero-fire-runtime.webp"',
    )
    expect(reviewSource).toContain(
      'data-atlas-src="../../assets/boss-animations/boss-motion-atlas-a.webp"',
    )
    expect(reviewSource).toContain(
      'data-atlas-src="../../assets/enemy-animations/enemy-motion-atlas-b.webp"',
    )
  })

  it('isolates exact integer source cells instead of CSS-positioning full atlases', () => {
    expect(reviewSource).toContain('drawIsolatedAtlasCell')
    expect(reviewSource).toContain(
      '(isolatedColumn * image.naturalWidth) / columns',
    )
    expect(reviewSource).toContain(
      '((isolatedColumn + 1) * image.naturalWidth) / columns',
    )
    expect(reviewSource).toContain('(row * image.naturalHeight) / rows')
    expect(reviewSource).toContain(
      '((row + 1) * image.naturalHeight) / rows',
    )
    expect(reviewSource).toContain('context.drawImage(')
    expect(reviewSource).toContain('sourceX0,')
    expect(reviewSource).toContain('sourceY0,')
    expect(reviewSource).toContain('atlasReady')
    expect(reviewSource.match(/data-atlas-role="hostile"/g)).toHaveLength(5)
    expect(reviewSource.match(/data-atlas-role="hero"/g)).toHaveLength(3)
    expect(reviewSource).not.toContain('--atlas-x')
    expect(reviewSource).not.toContain('--atlas-y')
    expect(reviewSource).not.toContain(
      'background-size: calc(var(--atlas-columns)',
    )
    expect(reviewSource).not.toContain(
      'background-position: var(--atlas-x)',
    )
  })

  it('uses animated broken material spray rather than diagrammatic primitives', () => {
    expect(reviewSource).toContain('drawPerimeterSpray')
    expect(reviewSource).toContain('drawBrokenLaneSpray')
    expect(reviewSource).toContain('drawMotes')
    expect(reviewSource).toContain('const coreAlpha')
    expect(reviewSource).toContain('index % 3 === 0')
    expect(reviewSource).toContain('index % 4 === 0')
    expect(reviewSource).toContain('if (visibility < 0.28) continue')
    expect(reviewSource).toContain(
      'const wrapIn = smoothstep(0, 0.05, progress)',
    )
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
    expect(reviewSource).toContain('bottom: max(10px, 7%);')
  })
})
