import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const EXPECTED_ASSETS = Object.freeze({
  'assets/spell-vfx/crescent-moonblade-v1.webp': Object.freeze({
    width: 1254,
    height: 1254,
    bytes: 178_552,
    sha256: 'aed877cb1e4fa68e6a60e62c543b08a07d8c162ced45ec78b74f4d6cb1ff9387',
  }),
  'assets/spell-vfx/crescent-moonblade-v1-mobile.webp': Object.freeze({
    width: 768,
    height: 768,
    bytes: 125_100,
    sha256: '10371b7958179b78891b2d95d89c8fe305f402094ca4c2765d7d76d888cddff0',
  }),
  'assets/spell-vfx/arc-choir-impact-v1.webp': Object.freeze({
    width: 1254,
    height: 1254,
    bytes: 70_914,
    sha256: '06b3a65073ee3dcda871ee93b78d00c5639fd317b20cc14010b1b594315abf41',
  }),
  'assets/spell-vfx/arc-choir-impact-v1-mobile.webp': Object.freeze({
    width: 768,
    height: 768,
    bytes: 49_468,
    sha256: '0ae0556959e0fb49ca8d9a19c69fa0422bea1b0e827d7b698b124b2cc98a2e74',
  }),
})

const readUint24LE = (buffer, offset) =>
  buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)

const inspectExtendedWebp = (buffer) => {
  expect(buffer.subarray(0, 4).toString('ascii')).toBe('RIFF')
  expect(buffer.subarray(8, 12).toString('ascii')).toBe('WEBP')
  expect(buffer.readUInt32LE(4) + 8).toBe(buffer.byteLength)
  expect(buffer.subarray(12, 16).toString('ascii')).toBe('VP8X')

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
    chunks,
  }
}

describe('Combat Lab authored Crescent and Arc atlases', () => {
  it.each(Object.entries(EXPECTED_ASSETS))(
    'keeps %s as a verified transparent 4x4 atlas',
    (path, expected) => {
      const assetUrl = new URL(`../../public/${path}`, import.meta.url)
      const buffer = readFileSync(fileURLToPath(assetUrl))
      const metadata = inspectExtendedWebp(buffer)

      expect(buffer.byteLength).toBe(expected.bytes)
      expect(metadata.width).toBe(expected.width)
      expect(metadata.height).toBe(expected.height)
      expect(metadata.width % 4).toBe(expected.width === 1254 ? 2 : 0)
      expect(metadata.height % 4).toBe(expected.height === 1254 ? 2 : 0)
      expect(metadata.chunks).toContain('ALPH')
      expect(createHash('sha256').update(buffer).digest('hex')).toBe(
        expected.sha256,
      )
    },
  )

  it('keeps all desktop/mobile payloads independent', () => {
    const hashes = Object.keys(EXPECTED_ASSETS).map((path) => {
      const assetUrl = new URL(`../../public/${path}`, import.meta.url)
      return createHash('sha256')
        .update(readFileSync(fileURLToPath(assetUrl)))
        .digest('hex')
    })
    expect(new Set(hashes).size).toBe(hashes.length)
  })
})
