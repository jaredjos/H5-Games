import {
  BlurFilter,
  Filter,
  GlProgram,
  UniformGroup,
  type ColorSource,
} from 'pixi.js'
import type { CharacterVisualProfile } from './visualQuality'

const FILTER_VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`

const CHARACTER_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;
uniform float uTime;
uniform float uIntensity;
uniform float uCrack;
uniform float uFlash;
uniform float uDistortion;
uniform vec3 uTint;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

void main(void) {
  vec2 uv = vTextureCoord;
  float bodyMask = texture(uTexture, uv).a;
  float centerMask = smoothstep(0.0, 0.42, bodyMask);
  float distortionNoise = valueNoise(uv * 13.0 + vec2(uTime * 0.22, -uTime * 0.17));
  vec2 shimmer = vec2(
    sin(uv.y * 42.0 + uTime * 3.1),
    cos(uv.x * 37.0 - uTime * 2.7)
  );
  uv += shimmer * (distortionNoise - 0.5) * uInputPixel.xy * uDistortion * centerMask * 4.0;
  uv = clamp(uv, uInputClamp.xy, uInputClamp.zw);

  vec4 source = texture(uTexture, uv);
  if (source.a <= 0.001) {
    finalColor = vec4(0.0);
    return;
  }

  vec3 color = source.rgb / source.a;
  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float leftAlpha = texture(uTexture, clamp(uv - vec2(uInputPixel.x * 1.5, 0.0), uInputClamp.xy, uInputClamp.zw)).a;
  float rightAlpha = texture(uTexture, clamp(uv + vec2(uInputPixel.x * 1.5, 0.0), uInputClamp.xy, uInputClamp.zw)).a;
  float topAlpha = texture(uTexture, clamp(uv - vec2(0.0, uInputPixel.y * 1.5), uInputClamp.xy, uInputClamp.zw)).a;
  float bottomAlpha = texture(uTexture, clamp(uv + vec2(0.0, uInputPixel.y * 1.5), uInputClamp.xy, uInputClamp.zw)).a;
  float edge = clamp(abs(leftAlpha - rightAlpha) + abs(topAlpha - bottomAlpha), 0.0, 1.0);

  float fractureA = abs(sin((uv.x * 18.0 + valueNoise(uv * 9.0) * 3.2) * 3.14159));
  float fractureB = abs(sin((uv.y * 21.0 - valueNoise(uv.yx * 12.0) * 2.6) * 3.14159));
  float fracture = smoothstep(0.965, 0.997, max(fractureA, fractureB));
  fracture *= smoothstep(0.08, 0.82, source.a) * (1.0 - luminance * 0.42) * uCrack;

  float highlight = smoothstep(0.52, 1.0, luminance);
  float emissive = edge * 0.76 + highlight * 0.34 + fracture * 1.35;
  vec3 graded = mix(vec3(luminance), color, 1.08);
  graded = (graded - 0.5) * 1.08 + 0.5;
  graded += uTint * emissive * uIntensity;
  graded = mix(graded, vec3(1.0, 0.94, 0.85), clamp(uFlash, 0.0, 1.0) * 0.82);

  finalColor = vec4(max(graded, 0.0) * source.a, source.a);
}
`

const REFRACTION_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uBackTexture;
uniform vec4 uInputPixel;
uniform vec4 uInputClamp;
uniform float uTime;
uniform float uStrength;

float hash21(vec2 point) {
  point = fract(point * vec2(234.34, 435.345));
  point += dot(point, point + 34.23);
  return fract(point.x * point.y);
}

void main(void) {
  vec4 effect = texture(uTexture, vTextureCoord);
  float peak = max(max(effect.r, effect.g), effect.b);
  float mask = smoothstep(0.018, 0.32, peak) * clamp(uStrength, 0.0, 1.0);
  float noise = hash21(floor(vTextureCoord * 48.0 + uTime * 2.0));
  vec2 direction = vec2(
    sin(vTextureCoord.y * 54.0 + uTime * 4.3 + noise),
    cos(vTextureCoord.x * 49.0 - uTime * 3.6 - noise)
  );
  vec2 offset = direction * uInputPixel.xy * (3.0 + mask * 7.0) * mask;
  vec2 displacedUv = clamp(vTextureCoord + offset, uInputClamp.xy, uInputClamp.zw);
  vec4 back = texture(uBackTexture, displacedUv);
  vec3 hostileGlow = effect.rgb * (1.12 + mask * 0.85);
  vec3 composite = mix(back.rgb, back.rgb * (0.92 - mask * 0.08) + hostileGlow, mask);
  finalColor = vec4(composite, back.a);
}
`

const SCREEN_GRADE_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uBoss;
uniform float uIntensity;

float hash21(vec2 point) {
  return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void) {
  vec4 source = texture(uTexture, vTextureCoord);
  vec2 centered = vTextureCoord - 0.5;
  float vignette = smoothstep(0.92, 0.24, dot(centered, centered) * 1.72);
  float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 shadowTone = mix(vec3(0.012, 0.026, 0.04), vec3(0.038, 0.009, 0.018), uBoss);
  vec3 highlightTone = mix(vec3(1.02, 0.93, 0.73), vec3(1.02, 0.68, 0.61), uBoss);
  vec3 graded = mix(shadowTone, source.rgb, smoothstep(0.0, 0.62, luminance));
  graded = mix(graded, source.rgb * highlightTone, smoothstep(0.45, 1.0, luminance) * 0.34);
  graded = (graded - 0.5) * 1.1 + 0.5;
  float grain = (hash21(gl_FragCoord.xy + floor(uTime * 12.0)) - 0.5) * 0.025;
  graded += grain;
  graded *= mix(0.74, 1.0, vignette);
  graded = mix(source.rgb, graded, clamp(uIntensity, 0.0, 1.0));
  finalColor = vec4(max(graded, 0.0), source.a);
}
`

const GROUND_SHADOW_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uIntensity;
uniform float uDistortion;
uniform vec3 uTint;

float hash21(vec2 point) {
  point = fract(point * vec2(127.1, 311.7));
  point += dot(point, point + 19.19);
  return fract(point.x * point.y);
}

void main(void) {
  vec2 point = (vTextureCoord - 0.5) * 2.0;
  float noise = hash21(floor((vTextureCoord + uTime * vec2(0.03, -0.02)) * 32.0));
  point.x += sin(point.y * 5.5 + uTime * 1.7) * uDistortion * 0.055;
  point.y += (noise - 0.5) * uDistortion * 0.08;
  float radius = dot(point, point);
  float core = smoothstep(1.0, 0.04, radius);
  float fringe = smoothstep(1.18, 0.2, radius);
  float alpha = (core * 0.5 + fringe * 0.22) * clamp(uIntensity, 0.0, 1.0);
  vec3 color = mix(vec3(0.0), uTint * 0.12, fringe * 0.42);
  finalColor = vec4(color * alpha, alpha);
}
`

const colorVector = (color: ColorSource) => {
  const numeric = typeof color === 'number' ? color : 0xffffff
  return new Float32Array([
    ((numeric >> 16) & 0xff) / 255,
    ((numeric >> 8) & 0xff) / 255,
    (numeric & 0xff) / 255,
  ])
}

export interface CharacterMaterialFilter {
  readonly filter: Filter
  readonly uniforms: UniformGroup
}

export function createCharacterMaterialFilter(
  color: ColorSource,
  profile: CharacterVisualProfile,
): CharacterMaterialFilter {
  const uniforms = new UniformGroup({
    uTime: { value: 0, type: 'f32' },
    uIntensity: { value: 0.25, type: 'f32' },
    uCrack: { value: 0, type: 'f32' },
    uFlash: { value: 0, type: 'f32' },
    uDistortion: { value: 0, type: 'f32' },
    uTint: { value: colorVector(color), type: 'vec3<f32>' },
  })
  return {
    filter: new Filter({
      glProgram: GlProgram.from({
        name: 'nighttrace-character-material',
        vertex: FILTER_VERTEX,
        fragment: CHARACTER_FRAGMENT,
      }),
      resources: { materialUniforms: uniforms },
      padding: 18,
      resolution: profile.materialFilterResolution,
      antialias: 'inherit',
    }),
    uniforms,
  }
}

export interface CharacterMaterialUniformState {
  readonly time: number
  readonly intensity: number
  readonly crack: number
  readonly flash: number
  readonly distortion: number
}

export function updateCharacterMaterialFilter(
  material: CharacterMaterialFilter | undefined,
  state: CharacterMaterialUniformState,
) {
  if (!material) return
  material.uniforms.uniforms.uTime = state.time
  material.uniforms.uniforms.uIntensity = state.intensity
  material.uniforms.uniforms.uCrack = state.crack
  material.uniforms.uniforms.uFlash = state.flash
  material.uniforms.uniforms.uDistortion = state.distortion
}

export function createCharacterBloomFilter(profile: CharacterVisualProfile) {
  if (profile.bloomStrength <= 0) return undefined
  return new BlurFilter({
    strength: profile.bloomStrength,
    quality: 1,
    kernelSize: 5,
    resolution: profile.bloomResolution,
    padding: 24,
  })
}

export interface RefractiveAtmosphereFilter {
  readonly filter: Filter
  readonly uniforms: UniformGroup
}

export function createRefractiveAtmosphereFilter(
  profile: CharacterVisualProfile,
): RefractiveAtmosphereFilter | undefined {
  if (!profile.refraction) return undefined
  const uniforms = new UniformGroup({
    uTime: { value: 0, type: 'f32' },
    uStrength: { value: 0, type: 'f32' },
  })
  return {
    filter: new Filter({
      glProgram: GlProgram.from({
        name: 'nighttrace-local-refraction',
        vertex: FILTER_VERTEX,
        fragment: REFRACTION_FRAGMENT,
      }),
      resources: { refractionUniforms: uniforms },
      padding: 20,
      resolution: profile.materialFilterResolution,
      blendRequired: true,
    }),
    uniforms,
  }
}

export function updateRefractiveAtmosphereFilter(
  material: RefractiveAtmosphereFilter | undefined,
  time: number,
  strength: number,
) {
  if (!material) return
  material.uniforms.uniforms.uTime = time
  material.uniforms.uniforms.uStrength = strength
  material.filter.enabled = strength > 0.025
}

export interface ScreenGradeFilter {
  readonly filter: Filter
  readonly uniforms: UniformGroup
}

export function createScreenGradeFilter(
  profile: CharacterVisualProfile,
): ScreenGradeFilter | undefined {
  if (!profile.screenGrade) return undefined
  const uniforms = new UniformGroup({
    uTime: { value: 0, type: 'f32' },
    uBoss: { value: 0, type: 'f32' },
    uIntensity: { value: 0.48, type: 'f32' },
  })
  return {
    filter: new Filter({
      glProgram: GlProgram.from({
        name: 'nighttrace-screen-grade',
        vertex: FILTER_VERTEX,
        fragment: SCREEN_GRADE_FRAGMENT,
      }),
      resources: { screenGradeUniforms: uniforms },
      resolution: 1,
    }),
    uniforms,
  }
}

export function updateScreenGradeFilter(
  material: ScreenGradeFilter | undefined,
  time: number,
  boss: boolean,
  intensity: number,
) {
  if (!material) return
  material.uniforms.uniforms.uTime = time
  material.uniforms.uniforms.uBoss = boss ? 1 : 0
  material.uniforms.uniforms.uIntensity = intensity
}

export interface GroundShadowFilter {
  readonly filter: Filter
  readonly uniforms: UniformGroup
}

export function createGroundShadowFilter(
  color: ColorSource,
  profile: CharacterVisualProfile,
): GroundShadowFilter {
  const uniforms = new UniformGroup({
    uTime: { value: 0, type: 'f32' },
    uIntensity: { value: 0.72, type: 'f32' },
    uDistortion: { value: 0.18, type: 'f32' },
    uTint: { value: colorVector(color), type: 'vec3<f32>' },
  })
  return {
    filter: new Filter({
      glProgram: GlProgram.from({
        name: 'nighttrace-ground-shadow',
        vertex: FILTER_VERTEX,
        fragment: GROUND_SHADOW_FRAGMENT,
      }),
      resources: { shadowUniforms: uniforms },
      resolution: profile.materialFilterResolution,
      padding: 8,
    }),
    uniforms,
  }
}

export function updateGroundShadowFilter(
  material: GroundShadowFilter | undefined,
  time: number,
  intensity: number,
  distortion: number,
) {
  if (!material) return
  material.uniforms.uniforms.uTime = time
  material.uniforms.uniforms.uIntensity = intensity
  material.uniforms.uniforms.uDistortion = distortion
}
