const CACHE_VERSION = 'v1.3.0'
const CACHE_PREFIX = 'nighttrace-'
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`
const SCOPE_URL = new URL(self.registration.scope)
const INDEX_URL = new URL('index.html', SCOPE_URL).href
const BUILD_MANIFEST_URL = new URL('.vite/manifest.json', SCOPE_URL).href
const SHELL_URLS = [
  new URL('./', SCOPE_URL).href,
  INDEX_URL,
  new URL('manifest.webmanifest', SCOPE_URL).href,
  new URL('favicon.svg', SCOPE_URL).href,
  new URL('icons/apple-touch-icon.png', SCOPE_URL).href,
  new URL('icons/nighttrace-192.png', SCOPE_URL).href,
  new URL('icons/nighttrace-512.png', SCOPE_URL).href,
  new URL('icons/nighttrace-maskable-512.png', SCOPE_URL).href,
  new URL('assets/campaign-disk-background.webp', SCOPE_URL).href,
  new URL('assets/cinder-foundry-arena.webp', SCOPE_URL).href,
  new URL('assets/first-beacon-arena.webp', SCOPE_URL).href,
  new URL('assets/glassreed-mire-arena.webp', SCOPE_URL).href,
  new URL('assets/nighttrace-boss-atlas.webp', SCOPE_URL).href,
  new URL('assets/nighttrace-enemy-atlas.webp', SCOPE_URL).href,
  new URL('assets/nighttrace-pickup-atlas.webp', SCOPE_URL).href,
  new URL('assets/nighttrace-hero-sheet.png', SCOPE_URL).href,
  new URL('assets/nighttrace-wordmark.png', SCOPE_URL).href,
  new URL('assets/hero-animations/hero-charge-runtime.webp', SCOPE_URL).href,
  new URL('assets/hero-animations/hero-fire-runtime.webp', SCOPE_URL).href,
  new URL('assets/hero-animations/hero-walk-runtime.webp', SCOPE_URL).href,
]

function isCacheable(response) {
  return response && response.ok && (response.type === 'basic' || response.type === 'default')
}

function scopedResourcePath(url) {
  if (url.origin !== SCOPE_URL.origin || !url.pathname.startsWith(SCOPE_URL.pathname)) {
    return undefined
  }
  return url.pathname.slice(SCOPE_URL.pathname.length)
}

function collectBuildFiles(manifest) {
  const files = new Set()
  for (const chunk of Object.values(manifest)) {
    if (!chunk || typeof chunk !== 'object') continue
    for (const value of [chunk.file, ...(chunk.css || []), ...(chunk.assets || [])]) {
      if (typeof value === 'string') files.add(new URL(value, SCOPE_URL).href)
    }
  }
  return [...files]
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE)
  await cache.addAll(SHELL_URLS)

  const manifestResponse = await fetch(BUILD_MANIFEST_URL, { cache: 'reload' })
  if (!isCacheable(manifestResponse)) {
    throw new Error('Unable to precache the production build manifest')
  }
  await cache.put(BUILD_MANIFEST_URL, manifestResponse.clone())
  const manifest = await manifestResponse.clone().json()
  const buildFiles = collectBuildFiles(manifest)
  await Promise.all(buildFiles.map((url) => cache.add(url)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith(CACHE_PREFIX) &&
                key !== SHELL_CACHE &&
                key !== ASSET_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function navigationResponse(request) {
  const cache = await caches.open(SHELL_CACHE)
  const installedIndex = await cache.match(INDEX_URL)
  if (installedIndex) return installedIndex

  try {
    const response = await fetch(request)
    if (isCacheable(response)) {
      await cache.put(INDEX_URL, response.clone())
    }
    return response
  } catch {
    return (await cache.match(INDEX_URL)) || Response.error()
  }
}

async function cacheFirst(request) {
  const shellCache = await caches.open(SHELL_CACHE)
  const precached = await shellCache.match(request)
  if (precached) return precached

  const assetCache = await caches.open(ASSET_CACHE)
  const cached = await assetCache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (isCacheable(response)) {
    await assetCache.put(request, response.clone())
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then(async (response) => {
      if (isCacheable(response)) await cache.put(request, response.clone())
      return response
    })
    .catch(() => undefined)

  return cached || (await network) || Response.error()
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const resourcePath = scopedResourcePath(url)
  if (resourcePath === undefined) return

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request))
    return
  }

  if (resourcePath.startsWith('assets/') || resourcePath.startsWith('icons/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_URLS' || !Array.isArray(event.data.urls)) return

  const urls = event.data.urls
    .slice(0, 64)
    .map((value) => {
      if (typeof value !== 'string') return undefined
      try {
        const url = new URL(value, SCOPE_URL)
        return scopedResourcePath(url) === undefined ? undefined : url.href
      } catch {
        return undefined
      }
    })
    .filter(Boolean)

  event.waitUntil(
    caches.open(ASSET_CACHE).then((cache) =>
      Promise.allSettled(
        urls.map(async (url) => {
          const request = new Request(url, { credentials: 'same-origin' })
          const cached = await cache.match(request)
          if (cached) return
          const response = await fetch(request)
          if (isCacheable(response)) await cache.put(request, response)
        }),
      ),
    ),
  )
})
