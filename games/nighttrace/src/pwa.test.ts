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

  it('uses the v1.16.3 cache namespace and precaches the sharp title hero', () => {
    expect(serviceWorkerSource).toContain("const CACHE_VERSION = 'v1.16.3'")
    expect(serviceWorkerSource).toContain(
      "new URL('assets/nighttrace-title-hero-v2.png', SCOPE_URL).href",
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
      'nighttrace:pwa-controller-reload:v1.16.3',
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
