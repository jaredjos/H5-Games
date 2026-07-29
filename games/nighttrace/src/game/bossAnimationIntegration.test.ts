import { describe, expect, it } from 'vitest'
import runtimeSource from './GameCanvas.tsx?raw'

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

describe('boss authored animation runtime integration', () => {
  it('loads and slices both sovereign atlases from their shared metadata', () => {
    const assetLoading = section(
      '    const assetLoad = Promise.all([',
      '    try {',
    )
    const frameSlicing = section(
      '      this.heroWalkFrames = this.sliceTexture(',
      '      this.pickupFrames = this.sliceTexture(',
    )

    for (const atlasIndex of [0, 1]) {
      expect(assetLoading).toContain(
        `appAssetUrl(BOSS_MOTION_ATLASES[${atlasIndex}].path)`,
      )
      expect(frameSlicing).toContain(
        `BOSS_MOTION_ATLASES[${atlasIndex}].columns`,
      )
      expect(frameSlicing).toContain(
        `BOSS_MOTION_ATLASES[${atlasIndex}].rows`,
      )
    }
  })

  it('snaps every atlas cell boundary to whole pixels to prevent pose bleed', () => {
    const textureSlicing = section(
      '  private sliceTexture(',
      '  private bossMotionTexture(',
    )

    expect(textureSlicing).toContain(
      'const left = Math.round((column * texture.width) / columns)',
    )
    expect(textureSlicing).toContain(
      'const right = Math.round(((column + 1) * texture.width) / columns)',
    )
    expect(textureSlicing).toContain(
      'const top = Math.round((row * texture.height) / rows)',
    )
    expect(textureSlicing).toContain(
      'const bottom = Math.round(((row + 1) * texture.height) / rows)',
    )
    expect(textureSlicing).toContain(
      'new Rectangle(left, top, right - left, bottom - top)',
    )
    expect(textureSlicing).not.toContain('texture.width / columns')
    expect(textureSlicing).not.toContain('texture.height / rows')
  })

  it('resolves and applies an authored texture on every rendered boss frame', () => {
    const enemyRendering = section(
      '    for (const enemy of this.enemies) {',
      '      const pose = enemy.isBoss',
    )

    expect(enemyRendering).toContain('resolveBossClipFrame({')
    expect(enemyRendering).toContain('bossId: this.bossLevel.bossId')
    expect(enemyRendering).toContain('time: this.motionClock')
    expect(enemyRendering).toContain('moving: moveRatio')
    expect(enemyRendering).toContain(
      'attackMotionStyle: enemy.attackMotionStyle',
    )
    expect(enemyRendering).toContain(
      'attackMotionRemaining: enemy.attackMotionRemaining',
    )
    expect(enemyRendering).toContain(
      'hitMotionRemaining: enemy.hitMotionRemaining',
    )
    expect(enemyRendering).toContain(
      'deathMotionRemaining: enemy.deathMotionRemaining',
    )
    expect(enemyRendering).toContain(
      'const authoredTexture = this.bossMotionTexture(clipFrame)',
    )
    expect(enemyRendering).toContain(
      'if (authoredTexture) enemy.sprite.texture = authoredTexture',
    )
  })

  it('publishes observable boss state, pose, and quadruped diagnostics', () => {
    const enemyRendering = section(
      '    for (const enemy of this.enemies) {',
      '      const pose = enemy.isBoss',
    )

    expect(enemyRendering).toContain(
      'this.host.dataset.bossAnimationState = clipFrame.state',
    )
    expect(enemyRendering).toContain(
      'this.host.dataset.bossAnimationPose = clipFrame.pose',
    )
    expect(enemyRendering).toContain(
      'this.host.dataset.bossQuadruped = String(clipFrame.quadruped)',
    )
  })

  it('layers per-boss idle and action choreography over the authored pose cells', () => {
    const bossMotion = section(
      '      const pose = enemy.isBoss',
      '      enemy.sprite.anchor.set(',
    )

    expect(bossMotion).toContain('sampleBossMotion({')
    expect(bossMotion).toContain('time: this.motionClock')
    expect(bossMotion).toContain('moving: moveRatio')
    expect(bossMotion).toContain('attackProgress')
    expect(bossMotion).toContain('attackAngle: enemy.attackMotionAngle')
    expect(bossMotion).toContain('attackStyle: enemy.attackMotionStyle')
    expect(bossMotion).toContain('levelId: this.bossLevel.id')
    expect(bossMotion).toContain('phase: enemy.phase')
  })

  it('faces every rendered boss toward the live player in every authored state', () => {
    const enemyRendering = section(
      '    for (const enemy of this.enemies) {',
      '    this.projectileTrailGraphics.clear()',
    )
    const enemyUpdate = section(
      '  private updateEnemies(',
      '  private performEnemySpecial(',
    )

    expect(enemyRendering).toContain(
      'bossSpriteFacingScale(this.bossLevel.bossId, enemy.facing)',
    )
    expect(enemyUpdate).toContain('if (enemy.isBoss)')
    expect(enemyUpdate).toContain(
      'if (Math.abs(dx) > 1) enemy.facing = dx >= 0 ? 1 : -1',
    )
  })

  it('initializes a spawning boss from the authored intro clip', () => {
    const spawning = section(
      '  private spawnBoss()',
      '  private updateEnemies(',
    )

    expect(spawning).toContain("enemy.attackMotionStyle = 'boss-intro'")
    expect(spawning).toContain(
      'enemy.facing = this.player.x >= x ? 1 : -1',
    )
    expect(spawning).toContain(
      'bossSpriteFacingScale(this.bossLevel.bossId, enemy.facing)',
    )
    expect(spawning).toContain('const initialClipFrame = resolveBossClipFrame({')
    expect(spawning).toContain(
      'this.bossMotionTexture(initialClipFrame) ??',
    )
  })

  it('keeps authored boss silhouettes on the foreground layer at full filter opacity', () => {
    const spawning = section(
      '  private spawnBoss()',
      '  private updateEnemies(',
    )

    expect(spawning).toContain('enemy.sprite.filters = null')
    expect(spawning).toContain(
      'this.enemyForegroundLayer.addChild(enemy.sprite)',
    )
    expect(spawning).not.toContain('enemy.sprite.alpha =')
  })
})
