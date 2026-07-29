import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ENEMY_MOTION_ATLASES } from './enemyAnimationClips'

const MAX_ATLAS_BYTES = 1_250_000
const EXPECTED_SHA256 = Object.freeze({
  'assets/enemy-animations/enemy-motion-atlas-a.webp':
    '1796be90eaadb8f0dfbc951514e791073e552a993c56d52791363c4cae856ad8',
  'assets/enemy-animations/enemy-motion-atlas-b.webp':
    '4482932ec85a069bc6d26285a8243945bb0e17fcd6887585a4996ba0d307c81b',
})

const assetPath = (relativePath) =>
  fileURLToPath(new URL(`../../public/${relativePath}`, import.meta.url))

const parseWebp = (relativePath) => {
  const bytes = readFileSync(assetPath(relativePath))
  expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
  expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP')
  expect(bytes.readUInt32LE(4) + 8).toBe(bytes.length)

  const chunks = new Map()
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const id = bytes.subarray(offset, offset + 4).toString('ascii')
    const size = bytes.readUInt32LE(offset + 4)
    const dataOffset = offset + 8
    expect(dataOffset + size, `${relativePath}:${id}`).toBeLessThanOrEqual(
      bytes.length,
    )
    chunks.set(id, { id, size, dataOffset })
    offset = dataOffset + size + (size & 1)
  }

  const lossless = chunks.get('VP8L')
  expect(lossless, `${relativePath}:VP8L`).toBeDefined()
  expect(bytes[lossless.dataOffset], `${relativePath}:VP8L signature`).toBe(0x2f)
  const dimensions = bytes.readUInt32LE(lossless.dataOffset + 1)
  const width = (dimensions & 0x3fff) + 1
  const height = ((dimensions >>> 14) & 0x3fff) + 1
  const alpha = (dimensions & 0x10000000) !== 0

  return {
    bytes,
    chunks,
    width,
    height,
    alpha,
  }
}

describe('horde authored animation WebP assets', () => {
  it('publishes both bounded 5x3 alpha atlases at runtime paths', () => {
    expect(ENEMY_MOTION_ATLASES).toHaveLength(2)

    for (const atlas of ENEMY_MOTION_ATLASES) {
      const image = parseWebp(atlas.path)
      expect(image.alpha, atlas.path).toBe(true)
      expect(image.chunks.has('VP8L'), `${atlas.path}:lossless payload`).toBe(
        true,
      )
      expect(image.bytes.length).toBeGreaterThan(700_000)
      expect(image.bytes.length).toBeLessThanOrEqual(MAX_ATLAS_BYTES)
      expect(image.width).toBe(1920)
      expect(image.height).toBe(1152)

      const snappedWidths = Array.from(
        { length: atlas.columns },
        (_, column) =>
          Math.round(((column + 1) * image.width) / atlas.columns) -
          Math.round((column * image.width) / atlas.columns),
      )
      const snappedHeights = Array.from(
        { length: atlas.rows },
        (_, row) =>
          Math.round(((row + 1) * image.height) / atlas.rows) -
          Math.round((row * image.height) / atlas.rows),
      )
      expect(new Set(snappedWidths)).toEqual(new Set([384]))
      expect(new Set(snappedHeights)).toEqual(new Set([384]))
      expect(createHash('sha256').update(image.bytes).digest('hex')).toBe(
        EXPECTED_SHA256[atlas.path],
      )
    }
  })

  it('rejects opaque or lossy chroma-key mattes that create block halos', () => {
    for (const atlas of ENEMY_MOTION_ATLASES) {
      const image = parseWebp(atlas.path)
      expect(image.alpha, `${atlas.path}:transparent matte`).toBe(true)
      expect(image.chunks.has('VP8L'), `${atlas.path}:lossless alpha`).toBe(true)
      expect(image.chunks.has('VP8'), `${atlas.path}:lossy color payload`).toBe(
        false,
      )
      expect(image.chunks.has('ALPH'), `${atlas.path}:split lossy alpha`).toBe(
        false,
      )
    }
  })
})
