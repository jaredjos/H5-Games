import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RankPips } from './Primitives'

describe('RankPips accessibility labels', () => {
  it('uses the supplied progression-system label', () => {
    expect(
      renderToStaticMarkup(<RankPips rank={3} max={5} label="Spell Rank" />),
    ).toContain('aria-label="Spell Rank 3 of 5"')
    expect(
      renderToStaticMarkup(<RankPips rank={2} max={3} label="Module Rank" />),
    ).toContain('aria-label="Module Rank 2 of 3"')
    expect(
      renderToStaticMarkup(<RankPips rank={4} max={5} label="Astrarium Rank" />),
    ).toContain('aria-label="Astrarium Rank 4 of 5"')
  })

  it('retains a generic fallback for callers outside those systems', () => {
    expect(renderToStaticMarkup(<RankPips rank={1} max={5} />)).toContain(
      'aria-label="Rank 1 of 5"',
    )
  })
})
