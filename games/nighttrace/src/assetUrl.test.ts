import { describe, expect, it } from 'vitest'
import { appAssetUrl } from './assetUrl'

describe('appAssetUrl', () => {
  it('leaves authored HTTPS media sources untouched', () => {
    const source = 'https://media.example.test/narration.wav'
    expect(appAssetUrl(source)).toBe(source)
  })

  it('keeps local assets deployment-relative', () => {
    expect(appAssetUrl('assets/cinematics/intro.webp'))
      .toMatch(/assets\/cinematics\/intro\.webp$/)
  })
})
