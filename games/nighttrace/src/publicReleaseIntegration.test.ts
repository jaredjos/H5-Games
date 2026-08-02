import { describe, expect, it } from 'vitest'
import appSource from './App.tsx?raw'
import primitivesSource from './ui/Primitives.tsx?raw'
import screensSource from './ui/Screens.tsx?raw'
import packageSource from '../package.json?raw'
import viteConfigSource from '../vite.config.ts?raw'

describe('public release internal-mode boundary', () => {
  it('guards both navigation and run launch centrally', () => {
    expect(appSource).toContain('setScreen(releaseSafeScreen(destination))')
    expect(appSource).toContain('if (!isRunModeAvailable(runConfig.mode))')
    expect(appSource).toContain("screen === 'boss-trials' && INTERNAL_MODES_ENABLED")
    expect(appSource).toContain("screen === 'combat-lab' && INTERNAL_MODES_ENABLED")
  })

  it('hides internal actions and shell navigation in public builds', () => {
    expect(screensSource).toContain('{INTERNAL_MODES_ENABLED ? (')
    expect(screensSource).toContain('INTERNAL QA · BOSS TRIALS + COMBAT LAB')
    expect(primitivesSource).toContain('const VISIBLE_NAV_ITEMS = NAV_ITEMS.filter')
    expect(primitivesSource).toContain('isScreenAvailable(item.id, INTERNAL_MODES_ENABLED)')
  })

  it('keeps the normal build public and provides a separate internal artifact', () => {
    const packageJson = JSON.parse(packageSource) as { scripts: Record<string, string> }
    expect(packageJson.scripts.build).not.toContain('--mode internal')
    expect(packageJson.scripts['build:internal']).toContain('--mode internal')
    expect(packageJson.scripts['build:internal']).toContain('--outDir dist-internal')
    expect(viteConfigSource).toContain('noindex,nofollow,noarchive')
  })
})
