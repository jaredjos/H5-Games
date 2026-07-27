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
    point = point * 2.03 + vec2(5.17, 9.31);
    amplitude *= 0.47;
  }
  return value;
}

void main(void) {
  float sourceMask = texture(uTexture, vTextureCoord).a;
  vec2 point = (vTextureCoord - 0.5) * 2.0;
  point = rotate2d(-uFacingAngle * 0.05) * point;

  vec2 compressed = vec2(point.x, point.y * 1.42);
  float distanceField = length(compressed);
  float bounds = 1.0 - smoothstep(0.46, 1.0, distanceField);
  vec2 drift = vec2(uTime * 0.018, -uTime * 0.012);
  float broadNoise = fbm(compressed * 2.8 + drift);
  float detailNoise = fbm(compressed.yx * 6.4 - drift * 1.7);
  float disturbedStone = smoothstep(
    0.3,
    0.92,
    broadNoise * 0.78 + detailNoise * 0.3
  ) * bounds;

  vec2 facing = vec2(cos(uFacingAngle), sin(uFacingAngle));
  float forward = dot(point, facing);
  float lateral = abs(dot(point, vec2(-facing.y, facing.x)));
  float wake = smoothstep(-0.38, 0.38, forward);
  wake *= 1.0 - smoothstep(0.18, 0.76, lateral);
  wake *= bounds * (0.66 + broadNoise * 0.34);

  vec2 moteGrid = point * 9.0 + vec2(uTime * 0.018, -uTime * 0.014);
  vec2 moteId = floor(moteGrid);
  vec2 moteCell = fract(moteGrid) - 0.5;
  float moteSeed = hash21(moteId);
  vec2 moteOffset = vec2(
    hash21(moteId + 3.17),
    hash21(moteId + 8.91)
  ) - 0.5;
  moteOffset *= 0.46;
  float mote = 1.0 - smoothstep(0.025, 0.09, length(moteCell - moteOffset));
  mote *= step(0.93, moteSeed) * bounds *
    (0.68 + sin(uTime * 1.9 + moteSeed * 18.0) * 0.32);

  float pressure = disturbedStone * (0.22 + uIntensity * 0.24);
  pressure += wake * uPulse * 0.26;
  pressure += mote * 0.24;
  float alpha = pressure * (0.12 + uIntensity * 0.15);
  alpha = min(uAlphaCeiling, max(0.0, alpha)) * bounds * sourceMask;

  vec3 stone = vec3(0.025, 0.055, 0.068);
  vec3 coldMineral = vec3(0.16, 0.52, 0.58);
  vec3 warmDust = vec3(0.65, 0.46, 0.23);
  vec3 color = mix(stone, coldMineral, broadNoise * 0.62 + mote * 0.24);
  color += warmDust * (wake * uPulse * 0.18 + detailNoise * 0.035);

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
