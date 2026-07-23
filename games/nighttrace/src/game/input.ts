import type { Vec2 } from '../shared/types'
import { clamp, normalize } from './math'

interface GameInputCallbacks {
  onInteract: () => void
}

export interface StickState {
  active: boolean
  origin: Vec2
  current: Vec2
  radius: number
}

const MOVEMENT_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
])

export class GameInput {
  private readonly element: HTMLElement
  private readonly callbacks: GameInputCallbacks
  private readonly keys = new Set<string>()
  private pointerId?: number
  private pointerOrigin: Vec2 = { x: 0, y: 0 }
  private pointerCurrent: Vec2 = { x: 0, y: 0 }
  private readonly stickRadius = 68

  constructor(element: HTMLElement, callbacks: GameInputCallbacks) {
    this.element = element
    this.callbacks = callbacks
    element.style.touchAction = 'none'

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)
    element.addEventListener('pointerdown', this.handlePointerDown)
    element.addEventListener('pointermove', this.handlePointerMove)
    element.addEventListener('pointerup', this.handlePointerUp)
    element.addEventListener('pointercancel', this.handlePointerUp)
  }

  getDirection(): Vec2 {
    let x = 0
    let y = 0

    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) x -= 1
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) x += 1
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) y -= 1
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) y += 1

    if (x !== 0 || y !== 0) return normalize(x, y)
    if (this.pointerId === undefined) return { x: 0, y: 0 }

    const deltaX = this.pointerCurrent.x - this.pointerOrigin.x
    const deltaY = this.pointerCurrent.y - this.pointerOrigin.y
    const magnitude = Math.hypot(deltaX, deltaY)
    if (magnitude < 7) return { x: 0, y: 0 }

    const direction = normalize(deltaX, deltaY)
    const strength = clamp(magnitude / this.stickRadius, 0, 1)
    return { x: direction.x * strength, y: direction.y * strength }
  }

  getStickState(): StickState {
    if (this.pointerId === undefined) {
      return {
        active: false,
        origin: this.pointerOrigin,
        current: this.pointerCurrent,
        radius: this.stickRadius,
      }
    }

    const deltaX = this.pointerCurrent.x - this.pointerOrigin.x
    const deltaY = this.pointerCurrent.y - this.pointerOrigin.y
    const magnitude = Math.hypot(deltaX, deltaY)
    const amount = magnitude > this.stickRadius ? this.stickRadius / magnitude : 1

    return {
      active: true,
      origin: this.pointerOrigin,
      current: {
        x: this.pointerOrigin.x + deltaX * amount,
        y: this.pointerOrigin.y + deltaY * amount,
      },
      radius: this.stickRadius,
    }
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    this.element.removeEventListener('pointerdown', this.handlePointerDown)
    this.element.removeEventListener('pointermove', this.handlePointerMove)
    this.element.removeEventListener('pointerup', this.handlePointerUp)
    this.element.removeEventListener('pointercancel', this.handlePointerUp)
    this.keys.clear()
    this.pointerId = undefined
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (MOVEMENT_KEYS.has(event.code)) {
      this.keys.add(event.code)
      event.preventDefault()
    }

    if (!event.repeat) this.callbacks.onInteract()
  }

  private handleKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code)
  }

  private handleBlur = () => {
    this.keys.clear()
    this.pointerId = undefined
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (this.pointerId !== undefined || event.button !== 0) return
    this.callbacks.onInteract()
    this.pointerId = event.pointerId
    this.pointerOrigin = this.toLocalPoint(event)
    this.pointerCurrent = this.pointerOrigin
    this.element.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  private handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return
    this.pointerCurrent = this.toLocalPoint(event)
    event.preventDefault()
  }

  private handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId)
    }
    this.pointerId = undefined
    event.preventDefault()
  }

  private toLocalPoint(event: PointerEvent): Vec2 {
    const bounds = this.element.getBoundingClientRect()
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    }
  }
}
