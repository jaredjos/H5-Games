import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BOSS_MOTION_ATLASES } from './bossAnimationClips'

const EXPECTED_ASSETS = Object.freeze({
  'assets/boss-animations/boss-motion-atlas-a.webp': Object.freeze({
    width: 1619,
    height: 971,
    bytes: 456_128,
    sha256:
      'bd032630a22a3551ed3a3060208f673cab15f2dbd5ee5d7f3040b591eb17a65b',
  }),
  'assets/boss-animations/boss-motion-atlas-b.webp': Object.freeze({
    width: 1536,
    height: 1024,
    bytes: 533_266,
    sha256:
      'd47d44190239fc564190b6f22afaa1f3ffc52c4e023e1a26fb8c008007223609',
  }),
})

const readUint24LE = (buffer, offset) =>
  buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)

const inspectExtendedWebp = (buffer) => {
  expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF')
  expect(buffer.subarray(8, 12).toString('ascii')).toBe('WEBP')
  expect(buffer.subarray(12, 16).toString('ascii')).toBe('VP8X')
  expect(buffer.readUInt32LE(4) + 8).toBe(buffer.byteLength)
  expect(buffer.readUInt32LE(16)).toBe(10)

  const chunks = []
  let offset = 12
  while (offset + 8 <= buffer.byteLength) {
    const chunkType = buffer.subarray(offset, offset + 4).toString('ascii')
    const chunkBytes = buffer.readUInt32LE(offset + 4)
    chunks.push(chunkType)
    offset += 8 + chunkBytes + (chunkBytes % 2)
  }

  return {
    width: readUint24LE(buffer, 24) + 1,
    height: readUint24LE(buffer, 27) + 1,
    hasAlpha: (buffer[20] & 0x10) !== 0,
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
      const metadata = inspectExtendedWebp(buffer)

      expect(buffer.byteLength).toBe(expected.bytes)
      expect(metadata.width).toBe(expected.width)
      expect(metadata.height).toBe(expected.height)
      expect(metadata.hasAlpha).toBe(true)
      expect(metadata.chunks).toEqual(['VP8X', 'ALPH', 'VP8 '])
      expect(createHash('sha256').update(buffer).digest('hex')).toBe(
        expected.sha256,
      )

      // A decoded RGBA atlas would occupy over 6 MB. The authored WebP files
      // remain below ten percent of that footprint without discarding alpha.
      expect(buffer.byteLength / (metadata.width * metadata.height * 4))
        .toBeLessThan(0.1)
      expect(metadata.width / atlas.columns).toBeGreaterThan(300)
      expect(metadata.height / atlas.rows).toBeGreaterThan(320)
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
