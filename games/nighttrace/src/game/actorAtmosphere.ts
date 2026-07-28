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
  vec2 groundPoint = vec2(point.x, point.y * 1.18);
  float radius = length(groundPoint);
  float bounds = 1.0 - smoothstep(0.64, 0.98, radius);

  vec2 smokeDrift = vec2(uTime * 0.032, -uTime * 0.024);
  float smokeNoise = fbm(
    groundPoint * (2.15 + uPhase * 0.42) + smokeDrift
  );
  float smokeDetail = fbm(
    groundPoint.yx * 4.35 - smokeDrift * 1.25
  );
  float smokeMass = smoothstep(
    0.24,
    0.88,
    smokeNoise * 0.78 + smokeDetail * 0.34
  );
  smokeMass *= (1.0 - smoothstep(0.08, 1.02, radius)) * bounds;

  float deformationNoise = fbm(
    groundPoint * 3.1 + vec2(-uTime * 0.012, uTime * 0.009)
  );
  float compressedStone = smoothstep(
    0.22,
    0.78,
    deformationNoise * 0.72 + (1.0 - radius) * 0.44
  );
  compressedStone *= bounds;

  vec2 attackDirection = vec2(cos(uAttackAngle), sin(uAttackAngle));
  vec2 attackNormal = vec2(-attackDirection.y, attackDirection.x);
  float forward = dot(groundPoint, attackDirection);
  float side = dot(groundPoint, attackNormal);
  vec2 pressurePoint = vec2(
    (forward - 0.12) * 0.82,
    side * (0.92 - uPhase * 0.08)
  );
  float pressureDistance = length(pressurePoint);
  float pressureBreakup = 0.68 + fbm(
    groundPoint * 3.45 + smokeDrift * 0.64
  ) * 0.32;
  float pressureMass = (
    1.0 - smoothstep(0.18, 0.92, pressureDistance)
  ) * pressureBreakup * bounds * uSpecial;

  float rubbleNoise = fbm(
    groundPoint * 7.2 + vec2(uTime * 0.018, -uTime * 0.011)
  );
  float disturbedRubble = smoothstep(
    0.72,
    0.94,
    rubbleNoise + pressureMass * 0.16
  );
  disturbedRubble *= bounds * (0.38 + compressedStone * 0.62);

  float pressurePulse =
    0.9 + sin(uTime * 1.55 + smokeNoise * 4.2) * 0.1;
  pressureMass *= pressurePulse;

  float idleEnergy = smokeMass * (0.13 + uIntensity * 0.11);
  idleEnergy += compressedStone * (0.08 + uIntensity * 0.1);
  float specialEnergy = pressureMass * (0.2 + uIntensity * 0.13);
  specialEnergy += disturbedRubble * uSpecial * 0.08;
  float alpha = min(
    uAlphaCeiling,
    max(0.0, idleEnergy + specialEnergy)
  ) * bounds * sourceMask;

  vec3 charcoal = vec3(0.042, 0.032, 0.035);
  vec3 bruisedStone = vec3(0.14, 0.075, 0.105);
  vec3 buriedOxide = vec3(0.33, 0.055, 0.05);
  vec3 hostileViolet = vec3(0.19, 0.055, 0.24);
  vec3 color = mix(
    charcoal,
    bruisedStone,
    compressedStone * 0.52 + smokeNoise * 0.22
  );
  color += mix(buriedOxide, hostileViolet, 0.48) *
    pressureMass * (0.18 + uIntensity * 0.12);
  color += bruisedStone * disturbedRubble * 0.11;

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
