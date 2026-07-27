export const HERO_POWER_FORBIDDEN_HELPERS = Object.freeze([
  'drawSegmentedRing',
  'drawJaggedRing',
  'drawRadialTicks',
  'drawStarburst',
  'drawDiamondGlyph',
  'drawBellGlyph',
  'drawPressureWedge',
] as const)

export type HeroPowerVisualViolationCode =
  | 'segmented-ring'
  | 'jagged-ring'
  | 'radial-ticks'
  | 'burst-lines'
  | 'generic-diamond'
  | 'outlined-gate'
  | 'polygon-fan'
  | 'outlined-zone'
  | 'concentric-circles'
  | 'decorative-rails'

export interface HeroPowerVisualViolation {
  readonly code: HeroPowerVisualViolationCode
  readonly index: number
  readonly evidence: string
}

const HELPER_VIOLATIONS = Object.freeze({
  drawSegmentedRing: 'segmented-ring',
  drawJaggedRing: 'jagged-ring',
  drawRadialTicks: 'radial-ticks',
  drawStarburst: 'burst-lines',
  drawDiamondGlyph: 'generic-diamond',
  drawBellGlyph: 'outlined-gate',
  drawPressureWedge: 'polygon-fan',
} as const satisfies Readonly<
  Record<
    (typeof HERO_POWER_FORBIDDEN_HELPERS)[number],
    HeroPowerVisualViolationCode
  >
>)

const SHAPE_OPERATIONS = ['.circle(', '.ellipse(', '.poly('] as const
const CHAIN_BOUNDARY_OPERATIONS = [
  '.fill(',
  '.moveTo(',
  '.lineTo(',
  '.stroke(',
] as const

const contextAt = (source: string, index: number) =>
  source
    .slice(Math.max(0, index - 48), Math.min(source.length, index + 96))
    .replace(/\s+/g, ' ')
    .trim()

const pushViolation = (
  violations: HeroPowerVisualViolation[],
  source: string,
  code: HeroPowerVisualViolationCode,
  index: number,
) => {
  violations.push(
    Object.freeze({
      code,
      index,
      evidence: contextAt(source, index),
    }),
  )
}

const allIndexesOf = (source: string, token: string) => {
  const indexes: number[] = []
  let cursor = 0
  while (cursor < source.length) {
    const index = source.indexOf(token, cursor)
    if (index < 0) break
    indexes.push(index)
    cursor = index + token.length
  }
  return indexes
}

const nearestOperationBefore = (source: string, index: number) => {
  const operations = [...SHAPE_OPERATIONS, ...CHAIN_BOUNDARY_OPERATIONS]
  let nearestIndex = -1
  let nearestOperation = ''
  for (const operation of operations) {
    const operationIndex = source.lastIndexOf(operation, index - 1)
    if (operationIndex <= nearestIndex) continue
    nearestIndex = operationIndex
    nearestOperation = operation
  }
  return { index: nearestIndex, operation: nearestOperation }
}

/**
 * Static presentation-policy inspection for one hero-power rendering scope.
 *
 * Pass one effect case, one projectile branch, or one texture recipe at a
 * time. A scope boundary is intentional: a single filled orb is allowed,
 * while two or more procedural circles in the same visual recipe are treated
 * as concentric diagram choreography.
 *
 * This function only reads source text. It does not import or touch collision,
 * damage, target selection, cooldown, or simulation state.
 */
export function inspectHeroPowerVisualScope(
  source: string,
): readonly HeroPowerVisualViolation[] {
  const safeSource = typeof source === 'string' ? source : ''
  const violations: HeroPowerVisualViolation[] = []

  for (const helper of HERO_POWER_FORBIDDEN_HELPERS) {
    for (const index of allIndexesOf(safeSource, `${helper}(`)) {
      pushViolation(
        violations,
        safeSource,
        HELPER_VIOLATIONS[helper],
        index,
      )
    }
  }

  for (const strokeIndex of allIndexesOf(safeSource, '.stroke(')) {
    const nearest = nearestOperationBefore(safeSource, strokeIndex)
    if (
      nearest.index >= 0 &&
      SHAPE_OPERATIONS.includes(
        nearest.operation as (typeof SHAPE_OPERATIONS)[number],
      )
    ) {
      pushViolation(
        violations,
        safeSource,
        'outlined-zone',
        nearest.index,
      )
    }
  }

  const circleIndexes = allIndexesOf(safeSource, '.circle(')
  if (circleIndexes.length > 1) {
    pushViolation(
      violations,
      safeSource,
      'concentric-circles',
      circleIndexes[1],
    )
  }

  const polygonFanPattern =
    /\b(?:star|starPoints|fan|fanPoints|spoke|spokePoints|rayPoints)\b/gi
  for (const match of safeSource.matchAll(polygonFanPattern)) {
    pushViolation(
      violations,
      safeSource,
      'polygon-fan',
      match.index ?? 0,
    )
  }

  const railPattern =
    /for\s*\([^)]*\b(?:side|echo)\b[^)]*\)\s*\{[\s\S]{0,1400}?(?:\.lineTo\s*\(|drawPolyline\s*\()/g
  for (const match of safeSource.matchAll(railPattern)) {
    pushViolation(
      violations,
      safeSource,
      'decorative-rails',
      match.index ?? 0,
    )
  }

  violations.sort(
    (left, right) =>
      left.index - right.index || left.code.localeCompare(right.code),
  )
  return Object.freeze(violations)
}
