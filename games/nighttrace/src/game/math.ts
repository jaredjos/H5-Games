import type { Vec2 } from '../shared/types'

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount

export const distanceSquared = (a: Vec2, b: Vec2) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

export const length = (x: number, y: number) => Math.hypot(x, y)

export const normalize = (x: number, y: number): Vec2 => {
  const magnitude = Math.hypot(x, y)
  return magnitude > 0.0001 ? { x: x / magnitude, y: y / magnitude } : { x: 0, y: 0 }
}

export const pointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || Number.EPSILON) +
          currentPoint.x

    if (crosses) inside = !inside
  }

  return inside
}

export const polygonArea = (points: Vec2[]) => {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length]
    area += points[index].x * next.y - next.x * points[index].y
  }
  return Math.abs(area) * 0.5
}

export const segmentIntersection = (
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2,
): Vec2 | undefined => {
  const firstX = firstEnd.x - firstStart.x
  const firstY = firstEnd.y - firstStart.y
  const secondX = secondEnd.x - secondStart.x
  const secondY = secondEnd.y - secondStart.y
  const denominator = firstX * secondY - firstY * secondX

  if (Math.abs(denominator) < 0.00001) return undefined

  const startX = secondStart.x - firstStart.x
  const startY = secondStart.y - firstStart.y
  const firstAmount = (startX * secondY - startY * secondX) / denominator
  const secondAmount = (startX * firstY - startY * firstX) / denominator

  if (firstAmount < 0 || firstAmount > 1 || secondAmount < 0 || secondAmount > 1) {
    return undefined
  }

  return {
    x: firstStart.x + firstAmount * firstX,
    y: firstStart.y + firstAmount * firstY,
  }
}

export class DeterministicRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x6d2b79f5
  }

  next() {
    let value = (this.state += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number) {
    return min + (max - min) * this.next()
  }

  integer(min: number, max: number) {
    return Math.floor(this.range(min, max + 1))
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }
}
