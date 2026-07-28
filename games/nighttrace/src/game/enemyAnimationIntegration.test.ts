import { describe, expect, it } from 'vitest'
import runtimeSource from './GameCanvas.tsx?raw'

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

describe('horde authored animation runtime integration', () => {
  it('loads and slices both horde atlases from shared metadata', () => {
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
        `appAssetUrl(ENEMY_MOTION_ATLASES[${atlasIndex}].path)`,
      )
      expect(frameSlicing).toContain(
        `ENEMY_MOTION_ATLASES[${atlasIndex}].columns`,
      )
      expect(frameSlicing).toContain(
        `ENEMY_MOTION_ATLASES[${atlasIndex}].rows`,
      )
    }
    expect(frameSlicing).not.toContain(
      'this.enemyFrames = this.sliceTexture(enemySheet, 3, 2)',
    )
  })

  it('resolves and applies authored frames to every rendered non-boss enemy', () => {
    const rendering = section(
      '    const activeHordeCount = this.enemies.reduce(',
      '      enemy.sprite.anchor.set(',
    )

    expect(rendering).toContain('resolveEnemyClipFrame({')
    expect(rendering).toContain('enemyId: enemy.id')
    expect(rendering).toContain('uid: enemy.uid')
    expect(rendering).toContain('time: this.motionClock')
    expect(rendering).toContain('moving: moveRatio')
    expect(rendering).toContain(
      'attackMotionStyle: enemy.attackMotionStyle',
    )
    expect(rendering).toContain(
      'attackMotionRemaining: enemy.attackMotionRemaining',
    )
    expect(rendering).toContain(
      'hitMotionRemaining: enemy.hitMotionRemaining',
    )
    expect(rendering).toContain(
      'deathMotionRemaining: enemy.deathMotionRemaining',
    )
    expect(rendering).toContain(
      'const authoredTexture = this.enemyMotionTexture(clipFrame)',
    )
    expect(rendering).toMatch(
      /authoredTexture\s*&&\s*enemy\.sprite\.texture\s*!==\s*authoredTexture/,
    )
    expect(rendering).toContain(
      'enemy.sprite.texture = authoredTexture',
    )
  })

  it('provides the atlas frame lookup and destroys every sliced horde texture', () => {
    expect(runtimeSource).toContain(
      'private enemyMotionTexture(frame: ResolvedEnemyClipFrame)',
    )
    expect(runtimeSource).toContain(
      'this.enemyMotionFrames[frame.atlasIndex]?.[frame.frameIndex]',
    )

    const destruction = section(
      '  private destroyApplication()',
      '  private tick =',
    )
    expect(destruction).toContain('...this.enemyMotionFrames[0]')
    expect(destruction).toContain('...this.enemyMotionFrames[1]')
    expect(destruction).toContain(
      'this.enemyMotionFrames[0].length = 0',
    )
    expect(destruction).toContain(
      'this.enemyMotionFrames[1].length = 0',
    )
  })

  it('initializes spawned horde sprites from the resolver instead of the legacy static atlas', () => {
    const spawning = section(
      '  private spawnEnemy()',
      '  private spawnShowcaseTargets()',
    )
    expect(spawning).toContain('resolveEnemyClipFrame({')
    expect(spawning).toContain('this.enemyMotionTexture(')
    expect(spawning).not.toContain(
      'enemy.sprite.texture = this.enemyFrames[frameIndex]',
    )
  })
})
