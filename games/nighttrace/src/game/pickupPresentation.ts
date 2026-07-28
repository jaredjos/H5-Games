import type { SupportPickupKind } from './balance'

export const SUPPORT_PICKUP_LIFETIME_SECONDS = 42

export interface PickupPresentationSettings {
  reducedFlash: boolean
  highContrast: boolean
  lifetimeSeconds?: number
}

export interface PickupFragment {
  angle: number
  distance: number
  size: number
  phase: number
}

export interface SupportPickupPresentation {
  primaryColor: number
  coreColor: number
  shadowColor: number
  beamHeight: number
  beamBodyWidth: number
  beamCoreWidth: number
  beamBodyAlpha: number
  beamCoreAlpha: number
  groundGlowAlpha: number
  runeScale: number
  runeRotation: number
  fragmentAlpha: number
  fragments: readonly PickupFragment[]
  arrival: number
  warning: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const smoothstep = (value: number) => {
  const safe = clamp01(value)
  return safe * safe * (3 - 2 * safe)
}

const PICKUP_COLORS: Readonly<
  Record<
    SupportPickupKind,
    Pick<SupportPickupPresentation, 'primaryColor' | 'coreColor' | 'shadowColor'>
  >
> = Object.freeze({
  dawnheart: Object.freeze({
    primaryColor: 0xff6f86,
    coreColor: 0xffeee8,
    shadowColor: 0x55151f,
  }),
  gravestar: Object.freeze({
    primaryColor: 0xffd978,
    coreColor: 0xffffe1,
    shadowColor: 0x4f3210,
  }),
  'pulse-core': Object.freeze({
    primaryColor: 0x70ecff,
    coreColor: 0xedffff,
    shadowColor: 0x103a4f,
  }),
})

function fragmentFor(seed: number, index: number): PickupFragment {
  const hash = Math.sin((seed + index * 37 + 11) * 12.9898) * 43758.5453
  const unit = hash - Math.floor(hash)
  return Object.freeze({
    angle: (Math.PI * 2 * index) / 3 + (unit - 0.5) * 0.44,
    distance: 24 + unit * 14 + index * 2,
    size: 3.6 + ((seed + index * 5) % 4) * 0.8,
    phase: unit * Math.PI * 2,
  })
}

/**
 * Deterministic, world-space presentation for rare support drops.
 *
 * The first 1.2 seconds carry the bright "heavens opened" arrival. The beam
 * then settles into a readable low-alpha beacon and becomes urgent during the
 * final four seconds without introducing extra circles or screen-wide flashes.
 */
export function supportPickupPresentation(
  kind: SupportPickupKind,
  ageSeconds: number,
  visualSeed: number,
  settings: PickupPresentationSettings,
): SupportPickupPresentation {
  const age = Math.max(0, Number.isFinite(ageSeconds) ? ageSeconds : 0)
  const seed = Math.max(0, Math.floor(Number.isFinite(visualSeed) ? visualSeed : 0))
  const arrival = smoothstep(age / 0.24)
  const arrivalHold = 1 - smoothstep((age - 0.24) / 0.96)
  const lifetime = Math.max(
    5,
    typeof settings.lifetimeSeconds === 'number' &&
      Number.isFinite(settings.lifetimeSeconds)
      ? settings.lifetimeSeconds
      : SUPPORT_PICKUP_LIFETIME_SECONDS,
  )
  const warning = smoothstep(
    (age - (lifetime - 4)) / 3.2,
  )
  const breath = 0.5 + 0.5 * Math.sin(age * (2.2 + (seed % 5) * 0.07) + seed * 0.19)
  const flashScale = settings.reducedFlash ? 0.62 : 1
  const contrastScale = settings.highContrast ? 1.18 : 1
  const bodyAlpha =
    (0.12 + arrivalHold * 0.24 + breath * 0.035 + warning * (0.06 + breath * 0.08)) *
    arrival *
    flashScale
  const coreAlpha =
    (0.32 + arrivalHold * 0.5 + warning * 0.25 + breath * 0.08) *
    arrival *
    flashScale *
    contrastScale
  const colors = PICKUP_COLORS[kind]

  return Object.freeze({
    ...colors,
    beamHeight: 290 + arrivalHold * 92 + warning * 28,
    beamBodyWidth: 48 + arrivalHold * 24 + warning * 8,
    beamCoreWidth: 5.5 + arrivalHold * 3.5 + warning * 2,
    beamBodyAlpha: clamp01(bodyAlpha),
    beamCoreAlpha: clamp01(coreAlpha),
    groundGlowAlpha: clamp01(
      (0.15 + arrivalHold * 0.28 + warning * 0.16 + breath * 0.05) *
        arrival *
        flashScale *
        contrastScale,
    ),
    runeScale: 0.9 + arrival * 0.1 + breath * 0.055 + warning * 0.05,
    runeRotation: age * (kind === 'gravestar' ? 0.22 : 0.12) + seed * 0.037,
    fragmentAlpha: clamp01(
      (0.44 + arrivalHold * 0.36 + warning * 0.2) *
        arrival *
        flashScale *
        contrastScale,
    ),
    fragments: Object.freeze([
      fragmentFor(seed, 0),
      fragmentFor(seed, 1),
      fragmentFor(seed, 2),
    ]),
    arrival,
    warning,
  })
}
