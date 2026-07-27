import { describe, expect, it } from 'vitest'
import {
  AUTHORED_SPELL_ASSET_DATA,
  AUTHORED_SPELL_ASSET_REVISION,
} from './authoredSpellAssetData'

const decodeWebp = (dataUri: string) => {
  const [prefix, encoded] = dataUri.split(',', 2)
  expect(prefix).toBe('data:image/webp;base64')
  const bytes = atob(encoded)
  expect(bytes.slice(0, 4)).toBe('RIFF')
  expect(bytes.slice(8, 12)).toBe('WEBP')
  return bytes.length
}

describe('authored spell texture bundle', () => {
  it('embeds valid WebP assets for every desktop and mobile material', () => {
    expect(AUTHORED_SPELL_ASSET_REVISION).toBe('v1.8.0')

    for (const dataUri of Object.values(AUTHORED_SPELL_ASSET_DATA)) {
      expect(decodeWebp(dataUri)).toBeGreaterThan(16_000)
    }
  })

  it('uses materially smaller mobile textures without changing image fidelity format', () => {
    expect(decodeWebp(AUTHORED_SPELL_ASSET_DATA.graveglassSpireMobile))
      .toBeLessThan(decodeWebp(AUTHORED_SPELL_ASSET_DATA.graveglassSpireDesktop))
    expect(decodeWebp(AUTHORED_SPELL_ASSET_DATA.eclipseGateMobile))
      .toBeLessThan(decodeWebp(AUTHORED_SPELL_ASSET_DATA.eclipseGateDesktop))
    expect(decodeWebp(AUTHORED_SPELL_ASSET_DATA.eclipseCathedralMobile))
      .toBeLessThan(decodeWebp(AUTHORED_SPELL_ASSET_DATA.eclipseCathedralDesktop))
  })
})
