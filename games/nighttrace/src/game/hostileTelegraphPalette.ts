import type { HostileColorFamily } from './enemyPresentation'

export interface HostileTelegraphPaletteInput {
  readonly family: HostileColorFamily
  readonly actorColor: number
  /** Zero is a restrained horde cue; one is a sovereign-grade cue. */
  readonly emphasis?: number
}

export interface HostileTelegraphMaterialPalette {
  readonly family: HostileColorFamily
  readonly geometryPolicy: 'grounded-material-only'
  readonly groundTint: number
  readonly smokeTint: number
  readonly seepTint: number
  readonly impactTint: number
  readonly groundOpacity: number
  readonly smokeOpacity: number
  readonly seepOpacity: number
  readonly impactOpacity: number
  readonly emission: number
  /** Maximum normalized footprint area allowed to carry luminous chroma. */
  readonly accentCoverage: number
}

interface FamilyAnchors {
  readonly ground: number
  readonly smoke: number
  readonly seep: number
  readonly impact: number
}

const FAMILY_ANCHORS = Object.freeze({
  crimson: Object.freeze({
    ground: 0x26080f,
    smoke: 0x42121d,
    seep: 0x6b2031,
    impact: 0xa74658,
  }),
  violet: Object.freeze({
    ground: 0x180922,
    smoke: 0x2d103d,
    seep: 0x52216d,
    impact: 0x87519a,
  }),
  venom: Object.freeze({
    ground: 0x161b0b,
    smoke: 0x293414,
    seep: 0x485c25,
    impact: 0x758943,
  }),
} as const satisfies Readonly<Record<HostileColorFamily, FamilyAnchors>>)

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

const clamp01 = (value: number) => clamp(value, 0, 1)

const sanitizeColor = (color: number) =>
  clamp(
    Math.floor(Number.isFinite(color) ? color : 0),
    0,
    0xffffff,
  )

const colorChannels = (color: number) => {
  const safe = sanitizeColor(color)
  return [
    (safe >> 16) & 0xff,
    (safe >> 8) & 0xff,
    safe & 0xff,
  ] as const
}

const mixColor = (from: number, to: number, amount: number) => {
  const start = colorChannels(from)
  const end = colorChannels(to)
  const mix = clamp01(amount)
  const channels = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * mix),
  )
  return (channels[0] << 16) | (channels[1] << 8) | channels[2]
}

export function hostileColorLuminance(color: number) {
  const channels = colorChannels(color).map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

/**
 * Converts an actor accent into bounded material chroma. The low-value ground
 * remains physical charcoal while smoke, seep, and impact carry progressively
 * more identity. It intentionally returns no geometric drawing instructions.
 */
export function resolveHostileTelegraphPalette(
  input: HostileTelegraphPaletteInput,
): HostileTelegraphMaterialPalette {
  const anchors = FAMILY_ANCHORS[input.family]
  const actorColor = sanitizeColor(input.actorColor)
  const emphasis = clamp01(
    Number.isFinite(input.emphasis) ? input.emphasis ?? 0 : 0,
  )

  return Object.freeze({
    family: input.family,
    geometryPolicy: 'grounded-material-only',
    groundTint: mixColor(anchors.ground, actorColor, 0.07),
    smokeTint: mixColor(anchors.smoke, actorColor, 0.13),
    seepTint: mixColor(anchors.seep, actorColor, 0.21),
    impactTint: mixColor(anchors.impact, actorColor, 0.28),
    groundOpacity: 0.4 + emphasis * 0.14,
    smokeOpacity: 0.17 + emphasis * 0.11,
    seepOpacity: 0.12 + emphasis * 0.1,
    impactOpacity: 0.3 + emphasis * 0.16,
    emission: 0.1 + emphasis * 0.12,
    accentCoverage: 0.05 + emphasis * 0.04,
  })
}
