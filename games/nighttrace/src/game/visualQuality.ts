export type CharacterVisualLod = 'cinematic' | 'balanced' | 'mobile'

export interface VisualCapabilitySnapshot {
  readonly viewportWidth: number
  readonly viewportHeight: number
  readonly devicePixelRatio: number
  readonly hardwareConcurrency: number
  readonly deviceMemory: number
  readonly pointerCoarse: boolean
}

export interface CharacterVisualProfile {
  readonly atlasVariant: 'desktop' | 'mobile'
  readonly rendererResolutionCap: number
  readonly rendererAntialias: boolean
  readonly generatedTextureResolution: number
  /**
   * Actor material passes must inherit the renderer resolution. Giving them an
   * independent numeric resolution silently rasterizes the hero and bosses into
   * a smaller intermediate texture before compositing them back into the scene.
   */
  readonly materialFilterResolution: 'inherit'
  readonly bloomStrength: number
  readonly bloomResolution: number
  readonly overlayFps: number
  readonly refraction: boolean
  readonly screenGrade: boolean
  readonly atmosphericParticles: number
}

export const CHARACTER_VISUAL_PROFILES: Readonly<
  Record<CharacterVisualLod, CharacterVisualProfile>
> = Object.freeze({
  cinematic: Object.freeze({
    atlasVariant: 'desktop',
    rendererResolutionCap: 2,
    rendererAntialias: true,
    generatedTextureResolution: 2,
    materialFilterResolution: 'inherit',
    bloomStrength: 0,
    bloomResolution: 1,
    overlayFps: 12,
    refraction: false,
    screenGrade: false,
    atmosphericParticles: 1,
  }),
  balanced: Object.freeze({
    atlasVariant: 'desktop',
    rendererResolutionCap: 2,
    rendererAntialias: true,
    generatedTextureResolution: 2,
    materialFilterResolution: 'inherit',
    bloomStrength: 0,
    bloomResolution: 1,
    overlayFps: 10,
    refraction: false,
    screenGrade: false,
    atmosphericParticles: 0.62,
  }),
  mobile: Object.freeze({
    // The smaller 192px-per-frame atlas did not survive high-DPI landscape
    // presentation. Keep the mobile LOD in motion/particle cadence instead.
    atlasVariant: 'desktop',
    rendererResolutionCap: 2,
    rendererAntialias: true,
    generatedTextureResolution: 2,
    materialFilterResolution: 'inherit',
    bloomStrength: 0,
    bloomResolution: 1,
    overlayFps: 8,
    refraction: false,
    screenGrade: false,
    atmosphericParticles: 0.34,
  }),
})

const safePositive = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback

export function resolveCharacterVisualLod(
  snapshot: VisualCapabilitySnapshot,
): CharacterVisualLod {
  const width = safePositive(snapshot.viewportWidth, 800)
  const height = safePositive(snapshot.viewportHeight, 450)
  const pixelRatio = safePositive(snapshot.devicePixelRatio, 1)
  const cores = safePositive(snapshot.hardwareConcurrency, 4)
  const memory = safePositive(snapshot.deviceMemory, 4)
  const shortEdge = Math.min(width, height)

  if (snapshot.pointerCoarse && shortEdge < 620) return 'mobile'
  if (shortEdge < 430 || memory < 3 || cores < 4) return 'mobile'
  if (width >= 1180 && height >= 640 && pixelRatio <= 2.25 && memory >= 6 && cores >= 8) {
    return 'cinematic'
  }
  return 'balanced'
}

export function browserVisualCapabilitySnapshot(): VisualCapabilitySnapshot {
  const extendedNavigator = navigator as Navigator & {
    deviceMemory?: number
  }
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: extendedNavigator.hardwareConcurrency || 4,
    deviceMemory: extendedNavigator.deviceMemory || 4,
    pointerCoarse: window.matchMedia?.('(pointer: coarse)').matches ?? false,
  }
}

export type CharacterMaterialActor = 'hero' | 'boss'

export interface CharacterMaterialFrameInput {
  readonly actor: CharacterMaterialActor
  readonly time: number
  readonly moving: number
  readonly attackProgress: number
  readonly hitProgress: number
  readonly deathProgress: number
  readonly fps: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

const progressFrame = (progress: number) =>
  Math.min(3, Math.floor(clamp01(progress) * 4))

/**
 * Both generated material atlases share the same four-row grammar:
 * idle, locomotion, attack and reaction/death. This keeps runtime sampling
 * deterministic and lets the mobile derivative use the exact same frame map.
 */
export function characterMaterialFrameAt(input: CharacterMaterialFrameInput) {
  if (input.deathProgress >= 0) return 12 + progressFrame(input.deathProgress)
  if (input.hitProgress >= 0) return 12 + progressFrame(input.hitProgress)
  if (input.attackProgress >= 0) return 8 + progressFrame(input.attackProgress)

  const safeTime = Math.max(0, input.time)
  const cadence = Math.max(1, input.fps)
  const loopFrame = Math.floor(safeTime * cadence) % 4
  if (input.moving > (input.actor === 'hero' ? 0.08 : 0.16)) return 4 + loopFrame
  return loopFrame
}
