import { describe, expect, it } from 'vitest'
import {
  GROUNDED_VFX_ASSET_DATA,
  GROUNDED_VFX_ASSET_REVISION,
} from './groundedVfxAssetData'

const decodeWebp = (dataUri: string) => {
  const [prefix, encoded] = dataUri.split(',', 2)
  expect(prefix).toBe('data:image/webp;base64')
  const bytes = atob(encoded)
  expect(bytes.slice(0, 4)).toBe('RIFF')
  expect(bytes.slice(8, 12)).toBe('WEBP')
  return bytes.length
}

describe('grounded hostile-material texture bundle', () => {
  it('embeds valid WebP assets for field and lane materials', () => {
    expect(GROUNDED_VFX_ASSET_REVISION).toBe('v1.9.0')

    for (const dataUri of Object.values(GROUNDED_VFX_ASSET_DATA)) {
      expect(decodeWebp(dataUri)).toBeGreaterThan(15_000)
    }
  })

  it('uses materially smaller mobile textures', () => {
    expect(decodeWebp(GROUNDED_VFX_ASSET_DATA.hostileGroundFieldMobile))
      .toBeLessThan(decodeWebp(GROUNDED_VFX_ASSET_DATA.hostileGroundFieldDesktop))
    expect(decodeWebp(GROUNDED_VFX_ASSET_DATA.hostileGroundLaneMobile))
      .toBeLessThan(decodeWebp(GROUNDED_VFX_ASSET_DATA.hostileGroundLaneDesktop))
  })
})
