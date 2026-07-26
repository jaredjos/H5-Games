import { Filter, GlProgram, UniformGroup } from 'pixi.js'

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

const HERO_SANCTUM_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uIntensity;
uniform float uPulse;
uniform float uFacingAngle;
uniform float uAlphaCeiling;

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

mat2 rotate2d(float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine);
}

float fineLine(float distanceValue, float width) {
  return 1.0 - smoothstep(width, width * 2.8, distanceValue);
}

float brokenLight(float coordinate, float offset) {
  float cell = fract(coordinate * 5.4 + offset);
  return smoothstep(0.08, 0.2, cell) * (1.0 - smoothstep(0.66, 0.9, cell));
}

void main(void) {
  float sourceMask = texture(uTexture, vTextureCoord).a;
  vec2 point = (vTextureCoord - 0.5) * 2.0;
  point = rotate2d(-uFacingAngle * 0.08) * point;

  float radius = length(point);
  float bounds = 1.0 - smoothstep(0.68, 0.98, radius);
  float fieldBand = smoothstep(0.14, 0.23, radius) *
    (1.0 - smoothstep(0.86, 1.02, radius));
  float shimmer = 0.88 + sin(uTime * 1.6 + radius * 10.0) * 0.12;
  float dash = brokenLight(radius, uTime * 0.025);

  float horizontal = fineLine(abs(point.y), 0.0085);
  float vertical = fineLine(abs(point.x), 0.0085);
  float cardinal = max(horizontal, vertical) * fieldBand * dash;

  vec2 diagonalPoint = rotate2d(0.785398) * point;
  float diagonal = max(
    fineLine(abs(diagonalPoint.x), 0.006),
    fineLine(abs(diagonalPoint.y), 0.006)
  );
  diagonal *= fieldBand * brokenLight(radius, 0.47 - uTime * 0.018) * 0.38;

  float diamondDistance = abs(point.x * 0.88) + abs(point.y);
  float diamond = fineLine(abs(diamondDistance - 0.34), 0.008);
  diamond *= brokenLight(
    atan(point.y, point.x) / 6.283185 + 0.5,
    0.28
  ) * 0.58;

  vec2 moteGrid = point * 8.0 + vec2(uTime * 0.025, -uTime * 0.018);
  vec2 moteId = floor(moteGrid);
  vec2 moteCell = fract(moteGrid) - 0.5;
  float moteSeed = hash21(moteId);
  vec2 moteOffset = vec2(
    hash21(moteId + 3.17),
    hash21(moteId + 8.91)
  ) - 0.5;
  moteOffset *= 0.46;
  float mote = 1.0 - smoothstep(0.025, 0.09, length(moteCell - moteOffset));
  mote *= step(0.91, moteSeed) * bounds *
    (0.72 + sin(uTime * 2.3 + moteSeed * 18.0) * 0.28);

  float compassEnergy = cardinal * 0.72 + diagonal * 0.44 + diamond * 0.58;
  float energy = compassEnergy * shimmer + mote * 0.34;
  float pulseLift = 1.0 + uPulse * (0.24 + sin(uTime * 3.1) * 0.06);
  float alpha = energy * (0.055 + uIntensity * 0.1) * pulseLift;
  alpha = min(uAlphaCeiling, max(0.0, alpha)) * bounds * sourceMask;

  float colorSplit = clamp(
    0.5 + point.x * 0.3 - point.y * 0.18 + (moteSeed - 0.5) * 0.16,
    0.0,
    1.0
  );
  vec3 teal = vec3(0.18, 0.78, 0.74);
  vec3 gold = vec3(1.0, 0.7, 0.26);
  vec3 color = mix(teal, gold, colorSplit);
  color += vec3(1.0, 0.91, 0.68) * (cardinal + diamond) * 0.16;

  finalColor = vec4(max(color, 0.0) * alpha, alpha);
}
`

const BOSS_HOSTILE_FRAGMENT = `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uIntensity;
uniform float uSpecial;
uniform float uAttackAngle;
uniform float uPhase;
uniform float uAlphaCeiling;

float hash21(vec2 point) {
  point = fract(point * vec2(127.1, 311.7));
  point += dot(point, point + 19.19);
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

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.56;
  for (int octave = 0; octave < 4; octave++) {
    value += valueNoise(point) * amplitude;
    point = point * 2.03 + vec2(7.13, 3.71);
    amplitude *= 0.48;
  }
  return value;
}

void main(void) {
  float sourceMask = texture(uTexture, vTextureCoord).a;
  vec2 point = (vTextureCoord - 0.5) * 2.0;
  float radius = length(point);
  float bounds = 1.0 - smoothstep(0.64, 0.98, radius);

  vec2 smokeDrift = vec2(uTime * 0.045, -uTime * 0.032);
  float smokeNoise = fbm(point * (2.7 + uPhase * 0.55) + smokeDrift);
  float smokeDetail = fbm(point.yx * 5.1 - smokeDrift * 1.4);
  float smoke = smoothstep(0.24, 0.92, smokeNoise + smokeDetail * 0.28);
  smoke *= (1.0 - smoothstep(0.12, 1.04, radius)) * bounds;

  float fractureNoiseA = fbm(point * 4.2 + vec2(uTime * 0.018, 0.0));
  float fractureNoiseB = fbm(point.yx * 4.9 - vec2(0.0, uTime * 0.014));
  float fractureA = abs(sin(
    (point.x * 8.4 + point.y * 1.9 + fractureNoiseA * 3.1) * 3.14159
  ));
  float fractureB = abs(sin(
    (point.y * 10.2 - point.x * 1.3 - fractureNoiseB * 2.8) * 3.14159
  ));
  float veins = smoothstep(0.972, 0.998, max(fractureA, fractureB));
  veins *= (1.0 - smoothstep(0.18, 0.96, radius)) *
    (0.45 + smokeNoise * 0.55);

  vec2 attackDirection = vec2(cos(uAttackAngle), sin(uAttackAngle));
  vec2 attackNormal = vec2(-attackDirection.y, attackDirection.x);
  float forward = dot(point, attackDirection);
  float side = abs(dot(point, attackNormal));
  float widening = 0.07 + max(0.0, forward) * (0.22 + uPhase * 0.04);
  float directionalSurge = smoothstep(-0.16, 0.1, forward);
  directionalSurge *= 1.0 - smoothstep(widening, widening + 0.12, side);
  directionalSurge *= 1.0 - smoothstep(0.88, 1.08, radius);

  vec2 hookDirection = vec2(
    cos(uAttackAngle + 1.94),
    sin(uAttackAngle + 1.94)
  );
  float hookForward = dot(point, hookDirection);
  float hookSide = abs(
    dot(point, vec2(-hookDirection.y, hookDirection.x))
  );
  float sideSurge = smoothstep(0.04, 0.42, hookForward);
  sideSurge *= 1.0 - smoothstep(0.055, 0.17, hookSide);
  sideSurge *= 1.0 - smoothstep(0.62, 0.96, radius);
  sideSurge *= 0.42;

  float surgePulse = 0.78 + sin(uTime * 4.8 + radius * 13.0) * 0.22;
  float surge = (directionalSurge + sideSurge) * surgePulse * uSpecial;

  float idleEnergy = smoke * (0.17 + uIntensity * 0.13);
  idleEnergy += veins * (0.16 + uIntensity * 0.2 + uPhase * 0.05);
  float specialEnergy = surge * (0.34 + uIntensity * 0.18);
  float alpha = min(
    uAlphaCeiling,
    max(0.0, idleEnergy + specialEnergy)
  ) * bounds * sourceMask;

  vec3 deepRed = vec3(0.48, 0.012, 0.026);
  vec3 hostileViolet = vec3(0.31, 0.025, 0.52);
  vec3 hotFracture = vec3(1.0, 0.12, 0.08);
  vec3 color = mix(deepRed, hostileViolet, smokeNoise * 0.72 + uPhase * 0.12);
  color += hotFracture * veins * (0.42 + uIntensity * 0.42);
  color += mix(hotFracture, hostileViolet, 0.42) * surge * 0.72;

  finalColor = vec4(max(color, 0.0) * alpha, alpha);
}
`

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const finiteOr = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? (value as number) : fallback

const normalizedTime = (value: number | undefined) =>
  Math.max(0, finiteOr(value, 0)) % 4096

const normalizedAngle = (value: number | undefined) => {
  const angle = finiteOr(value, 0)
  const tau = Math.PI * 2
  return ((angle + Math.PI) % tau + tau) % tau - Math.PI
}

export interface HeroSanctumState {
  readonly time: number
  readonly intensity: number
  readonly pulse: number
  readonly facingAngle: number
}

export interface HeroSanctumParameters extends HeroSanctumState {
  readonly alphaCeiling: number
}

export interface BossHostileFieldState {
  readonly time: number
  readonly intensity: number
  readonly special: number
  readonly attackAngle: number
  /** Normalized encounter phase in the inclusive range 0-1. */
  readonly phase: number
}

export interface BossHostileFieldParameters extends BossHostileFieldState {
  readonly alphaCeiling: number
}

export function resolveHeroSanctumParameters(
  state: Partial<HeroSanctumState> = {},
): Readonly<HeroSanctumParameters> {
  const intensity = clamp01(finiteOr(state.intensity, 0.32))
  const pulse = clamp01(finiteOr(state.pulse, 0))
  return Object.freeze({
    time: normalizedTime(state.time),
    intensity,
    pulse,
    facingAngle: normalizedAngle(state.facingAngle),
    alphaCeiling: 0.11 + intensity * 0.07 + pulse * 0.04,
  })
}

export function resolveBossHostileFieldParameters(
  state: Partial<BossHostileFieldState> = {},
): Readonly<BossHostileFieldParameters> {
  const intensity = clamp01(finiteOr(state.intensity, 0.4))
  const special = clamp01(finiteOr(state.special, 0))
  const phase = clamp01(finiteOr(state.phase, 0.5))
  return Object.freeze({
    time: normalizedTime(state.time),
    intensity,
    special,
    attackAngle: normalizedAngle(state.attackAngle),
    phase,
    alphaCeiling:
      0.14 + intensity * 0.06 + phase * 0.02 + special * 0.2,
  })
}

export type ActorAtmosphereKind = 'hero-sanctum' | 'boss-hostile'

export interface ActorAtmosphereField {
  readonly kind: ActorAtmosphereKind
  readonly filter: Filter
  readonly uniforms: UniformGroup
  readonly destroyed: boolean
  destroy(): void
}

export interface HeroSanctumField extends ActorAtmosphereField {
  readonly kind: 'hero-sanctum'
}

export interface BossHostileField extends ActorAtmosphereField {
  readonly kind: 'boss-hostile'
}

const createFieldHandle = <Kind extends ActorAtmosphereKind>(
  kind: Kind,
  filter: Filter,
  uniforms: UniformGroup,
) => {
  let destroyed = false
  return Object.freeze({
    kind,
    filter,
    uniforms,
    get destroyed() {
      return destroyed
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      filter.destroy()
    },
  })
}

export function createHeroSanctumField(
  initialState: Partial<HeroSanctumState> = {},
): HeroSanctumField {
  const uniforms = new UniformGroup({
    uTime: { value: 0, type: 'f32' },
    uIntensity: { value: 0.32, type: 'f32' },
    uPulse: { value: 0, type: 'f32' },
    uFacingAngle: { value: 0, type: 'f32' },
    uAlphaCeiling: { value: 0.1324, type: 'f32' },
  })
  const field = createFieldHandle(
    'hero-sanctum',
    new Filter({
      glProgram: GlProgram.from({
        name: 'nighttrace-hero-sanctum-ground-field',
        vertex: FILTER_VERTEX,
        fragment: HERO_SANCTUM_FRAGMENT,
      }),
      resources: { heroSanctumUniforms: uniforms },
      resolution: 'inherit',
      antialias: 'inherit',
      padding: 0,
      blendRequired: false,
    }),
    uniforms,
  ) as HeroSanctumField
  updateHeroSanctumField(field, initialState)
  return field
}

export function updateHeroSanctumField(
  field: HeroSanctumField | undefined,
  state: Partial<HeroSanctumState>,
) {
  if (!field || field.destroyed) return
  const resolved = resolveHeroSanctumParameters(state)
  field.uniforms.uniforms.uTime = resolved.time
  field.uniforms.uniforms.uIntensity = resolved.intensity
  field.uniforms.uniforms.uPulse = resolved.pulse
  field.uniforms.uniforms.uFacingAngle = resolved.facingAngle
  field.uniforms.uniforms.uAlphaCeiling = resolved.alphaCeiling
}

export function createBossHostileField(
  initialState: Partial<BossHostileFieldState> = {},
): BossHostileField {
  const uniforms = new UniformGroup({
    uTime: { value: 0, type: 'f32' },
    uIntensity: { value: 0.4, type: 'f32' },
    uSpecial: { value: 0, type: 'f32' },
    uAttackAngle: { value: 0, type: 'f32' },
    uPhase: { value: 0.5, type: 'f32' },
    uAlphaCeiling: { value: 0.174, type: 'f32' },
  })
  const field = createFieldHandle(
    'boss-hostile',
    new Filter({
      glProgram: GlProgram.from({
        name: 'nighttrace-boss-hostile-ground-field',
        vertex: FILTER_VERTEX,
        fragment: BOSS_HOSTILE_FRAGMENT,
      }),
      resources: { bossAtmosphereUniforms: uniforms },
      resolution: 'inherit',
      antialias: 'inherit',
      padding: 0,
      blendRequired: false,
    }),
    uniforms,
  ) as BossHostileField
  updateBossHostileField(field, initialState)
  return field
}

export function updateBossHostileField(
  field: BossHostileField | undefined,
  state: Partial<BossHostileFieldState>,
) {
  if (!field || field.destroyed) return
  const resolved = resolveBossHostileFieldParameters(state)
  field.uniforms.uniforms.uTime = resolved.time
  field.uniforms.uniforms.uIntensity = resolved.intensity
  field.uniforms.uniforms.uSpecial = resolved.special
  field.uniforms.uniforms.uAttackAngle = resolved.attackAngle
  field.uniforms.uniforms.uPhase = resolved.phase
  field.uniforms.uniforms.uAlphaCeiling = resolved.alphaCeiling
}

export function destroyActorAtmosphereField(
  field: ActorAtmosphereField | undefined,
) {
  field?.destroy()
}
