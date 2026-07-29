import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOSS_MOTION_ATLASES } from './bossAnimationClips'

const EXPECTED_ASSETS = Object.freeze({
  'assets/boss-animations/boss-motion-atlas-a.webp': Object.freeze({
    width: 1920,
    height: 1152,
    bytes: 1_061_216,
    sha256:
      'b09525a931d6156353e9e0a6be2b19f77fb6c6cb2aacd0e740cb27fb19559ea1',
  }),
  'assets/boss-animations/boss-motion-atlas-b.webp': Object.freeze({
    width: 1920,
    height: 1152,
    bytes: 1_142_326,
    sha256:
      'eee4759c86a16cb1c2455b657f71142fe3537ccdb0ad6fa274565ab505e69201',
  }),
})

const inspectLosslessWebp = (buffer) => {
  expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF')
  expect(buffer.subarray(8, 12).toString('ascii')).toBe('WEBP')
  expect(buffer.readUInt32LE(4) + 8).toBe(buffer.byteLength)

  const chunks = []
  let losslessOffset = -1
  let offset = 12
  while (offset + 8 <= buffer.byteLength) {
    const chunkType = buffer.subarray(offset, offset + 4).toString('ascii')
    const chunkBytes = buffer.readUInt32LE(offset + 4)
    chunks.push(chunkType)
    if (chunkType === 'VP8L') losslessOffset = offset + 8
    offset += 8 + chunkBytes + (chunkBytes % 2)
  }
  expect(losslessOffset).toBeGreaterThanOrEqual(0)
  expect(buffer[losslessOffset]).toBe(0x2f)
  const dimensions = buffer.readUInt32LE(losslessOffset + 1)

  return {
    width: (dimensions & 0x3fff) + 1,
    height: ((dimensions >>> 14) & 0x3fff) + 1,
    hasAlpha: (dimensions & 0x10000000) !== 0,
    chunks,
  }
}

describe('published sovereign WebP animation atlases', () => {
  it.each(BOSS_MOTION_ATLASES)(
    'keeps $path as the verified optimized alpha payload',
    (atlas) => {
      const expected = EXPECTED_ASSETS[atlas.path]
      const assetUrl = new URL(`../../public/${atlas.path}`, import.meta.url)
      const buffer = readFileSync(fileURLToPath(assetUrl))
      const metadata = inspectLosslessWebp(buffer)

      expect(buffer.byteLength).toBe(expected.bytes)
      expect(metadata.width).toBe(expected.width)
      expect(metadata.height).toBe(expected.height)
      expect(metadata.hasAlpha).toBe(true)
      expect(metadata.chunks).toEqual(['VP8L'])
      expect(createHash('sha256').update(buffer).digest('hex')).toBe(
        expected.sha256,
      )

      // The isolated 5x3 atlas remains compact while preserving lossless alpha.
      expect(buffer.byteLength / (metadata.width * metadata.height * 4))
        .toBeLessThan(0.14)
      expect(metadata.width / atlas.columns).toBe(384)
      expect(metadata.height / atlas.rows).toBe(384)
    },
  )

  it('keeps the two sovereign payloads independent rather than duplicated', () => {
    const hashes = BOSS_MOTION_ATLASES.map((atlas) => {
      const assetUrl = new URL(`../../public/${atlas.path}`, import.meta.url)
      return createHash('sha256')
        .update(readFileSync(fileURLToPath(assetUrl)))
        .digest('hex')
    })

    expect(new Set(hashes).size).toBe(BOSS_MOTION_ATLASES.length)
  })
})
