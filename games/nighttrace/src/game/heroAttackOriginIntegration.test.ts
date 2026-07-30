import { describe, expect, it } from 'vitest'
import runtimeSourceRaw from './GameCanvas.tsx?raw'

const runtimeSource = runtimeSourceRaw.replace(/\r\n/g, '\n')

const section = (startMarker: string, endMarker: string) => {
  const start = runtimeSource.indexOf(startMarker)
  const end = runtimeSource.indexOf(endMarker, start + startMarker.length)
  expect(start, startMarker).toBeGreaterThanOrEqual(0)
  expect(end, endMarker).toBeGreaterThan(start)
  return runtimeSource.slice(start, end)
}

describe('hero-originating spell integration', () => {
  it('aims direct attacks from one shared authored weapon point', () => {
    const fireWeapon = section(
      '  private fireWeapon(owned: OwnedWeapon)',
      '  private pushWeaponEffect(',
    )
    const spawnProjectile = section(
      '  private spawnProjectile(',
      '  private updateProjectiles(',
    )

    expect(fireWeapon).toContain('const weaponOrigin = this.currentHeroWeaponOrigin()')
    expect(fireWeapon).toContain('angleFromOriginToTarget(weaponOrigin, target)')
    expect(fireWeapon).toContain("'hero-cast',\n      owned.id")
    expect(fireWeapon).toContain('facingAngle,')
    expect(spawnProjectile).toContain('const origin = this.currentHeroWeaponOrigin()')
    expect(spawnProjectile).not.toContain('this.player.y + Math.sin(angle) * 28')
  })

  it('starts cast flashes and Arc Choir from the same weapon point', () => {
    const castVfx = section(
      '  private emitWeaponCastVfx(',
      '  private emitProjectileImpactVfx(',
    )
    const arcChoir = section(
      '  private chainLightning(',
      '  private bossAttack(',
    )

    expect(castVfx).toContain('const castOrigin = this.currentHeroWeaponOrigin()')
    expect(castVfx).toContain('x: pattern?.aimPoint.x ?? castOrigin.x')
    expect(arcChoir).toContain('const origin = this.currentHeroWeaponOrigin()')
    expect(arcChoir).toContain('const points: Vec2[] = [{ ...origin }]')
  })

  it('keeps Graveglass and Eclipse world-targeting geometry rooted at the player', () => {
    const replacementCast = section(
      '  private castReplacementWeapon(',
      '  private fireWeapon(owned: OwnedWeapon)',
    )

    expect(replacementCast).toContain(
      'origin: { x: this.player.x, y: this.player.y }',
    )
  })
})
