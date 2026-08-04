import { describe, expect, it, vi } from 'vitest'
import serviceWorkerSource from '../public/sw.js?raw'
import { createControllerChangeReloadHandler } from './pwa'

function memoryStorage(initialValue?: string) {
  let value = initialValue
  return {
    getItem: vi.fn(() => value ?? null),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue
    }),
  }
}

describe('Nighttrace PWA delivery', () => {
  it('fetches navigation from the network before using the cached shell fallback', () => {
    const navigationStart = serviceWorkerSource.indexOf('async function navigationResponse')
    const navigationEnd = serviceWorkerSource.indexOf('async function cacheFirst', navigationStart)
    const navigationSource = serviceWorkerSource.slice(navigationStart, navigationEnd)

    expect(navigationSource).toContain("fetch(request, { cache: 'reload' })")
    expect(navigationSource.indexOf("fetch(request, { cache: 'reload' })"))
      .toBeLessThan(navigationSource.indexOf('cache.match(INDEX_URL)'))
    expect(navigationSource).not.toContain('if (installedIndex) return installedIndex')
  })

  it('uses the v1.24.1 cache namespace and precaches title and cinematic art', () => {
    expect(serviceWorkerSource).toContain("const CACHE_VERSION = 'v1.24.1'")
    expect(serviceWorkerSource).toContain(
      "new URL('assets/nighttrace-title-hero-v2.png', SCOPE_URL).href",
    )
    expect(serviceWorkerSource).toContain(
      "new URL('assets/cinematics/intro-a-world-without-dawn.webp', SCOPE_URL).href",
    )
    expect(serviceWorkerSource).toContain(
      "new URL('assets/cinematics/finale-the-first-light.webp', SCOPE_URL).href",
    )
    for (const atlas of [
      'astral-verdict-v1.webp',
      'astral-verdict-v1-mobile.webp',
      'comet-orbit-v1.webp',
      'comet-orbit-v1-mobile.webp',
      'cinderwake-reaver-v1.webp',
      'cinderwake-reaver-v1-mobile.webp',
      'crescent-moonblade-v1.webp',
      'crescent-moonblade-v1-mobile.webp',
      'arc-choir-impact-v1.webp',
      'arc-choir-impact-v1-mobile.webp',
    ]) {
      expect(serviceWorkerSource).toContain(
        `new URL('assets/spell-vfx/${atlas}', SCOPE_URL).href`,
      )
    }
    expect(serviceWorkerSource).not.toContain('veilglass-reliquary-v1')
    for (const plate of [
      'interlude-03-shattered-arcade',
      'interlude-04-prism-garden',
      'interlude-05-drowned-causeway',
      'interlude-06-stormrail-vault',
      'interlude-07-hourglass-vault',
      'interlude-09-void-observatory',
    ]) {
      expect(serviceWorkerSource).toContain(
        `new URL('assets/cinematics/${plate}.webp', SCOPE_URL).href`,
      )
    }
    expect(serviceWorkerSource).toContain(
      "'assets/cinematics/audio/campaign/manifest.json'",
    )
    expect(serviceWorkerSource).toContain('collectCinematicVoiceFiles(manifest)')
    expect(serviceWorkerSource).toContain('manifest.expectedClipCount')
    expect(serviceWorkerSource).toContain('await precacheCinematicVoices(cache)')
    expect(serviceWorkerSource).not.toContain(
      'assets/cinematics/audio/last-star/',
    )
    expect(serviceWorkerSource).not.toContain(
      'assets/cinematics/audio/memories/',
    )
  })

  it('streams range media without caching partial MP3 responses', () => {
    const rangeGuard = serviceWorkerSource.indexOf(
      "if (request.headers.has('range'))",
    )
    const assetCache = serviceWorkerSource.indexOf(
      "if (resourcePath.startsWith('assets/')",
    )
    expect(rangeGuard).toBeGreaterThanOrEqual(0)
    expect(rangeGuard).toBeLessThan(assetCache)
    expect(serviceWorkerSource).toContain('response.status === 200')
  })

  it('refreshes same-scope windows only when activation replaced an older cache', () => {
    const activationStart = serviceWorkerSource.indexOf('async function activateServiceWorker')
    const activationEnd = serviceWorkerSource.indexOf(
      "self.addEventListener('activate'",
      activationStart,
    )
    const activationSource = serviceWorkerSource.slice(activationStart, activationEnd)

    expect(activationSource).toContain('const staleCacheKeys')
    expect(activationSource).toContain('await self.clients.claim()')
    expect(activationSource).toContain('if (staleCacheKeys.length === 0) return')
    expect(activationSource).toContain('scopedResourcePath(url) === undefined')
    expect(activationSource).toContain('return client.navigate(client.url)')
    expect(activationSource.indexOf('await self.clients.claim()'))
      .toBeLessThan(activationSource.indexOf('client.navigate(client.url)'))
  })

  it('reloads exactly once when an existing page receives a new controller', () => {
    const reload = vi.fn()
    const storage = memoryStorage()
    const onControllerChange = createControllerChangeReloadHandler({
      shouldReload: true,
      reload,
      storage,
    })

    onControllerChange()
    onControllerChange()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenCalledWith(
      'nighttrace:pwa-controller-reload:v1.24.1',
      '1',
    )
  })

  it('does not reload for a first install or repeat a release reload across handlers', () => {
    const firstInstallReload = vi.fn()
    createControllerChangeReloadHandler({
      shouldReload: false,
      reload: firstInstallReload,
      storage: memoryStorage(),
    })()
    expect(firstInstallReload).not.toHaveBeenCalled()

    const repeatedReload = vi.fn()
    createControllerChangeReloadHandler({
      shouldReload: true,
      reload: repeatedReload,
      storage: memoryStorage('1'),
    })()
    expect(repeatedReload).not.toHaveBeenCalled()
  })
})
