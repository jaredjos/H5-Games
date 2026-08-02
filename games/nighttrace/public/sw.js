const CACHE_VERSION = 'v1.23.0'
const CINEMATIC_VOICE_REVISION = 'd4a1cca3e00524ee'
const CACHE_PREFIX = 'nighttrace-'
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`
const SCOPE_URL = new URL(self.registration.scope)
const INDEX_URL = new URL('index.html', SCOPE_URL).href
const BUILD_MANIFEST_URL = new URL('.vite/manifest.json', SCOPE_URL).href
const CINEMATIC_VOICE_MANIFEST_URL = new URL(
  'assets/cinematics/audio/campaign/manifest.json',
  SCOPE_URL,
).href
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
  new URL('assets/cinematics/intro-a-world-without-dawn.webp', SCOPE_URL).href,
  new URL('assets/cinematics/finale-the-first-light.webp', SCOPE_URL).href,
  new URL('assets/cinematics/interlude-03-shattered-arcade.webp', SCOPE_URL).href,
  new URL('assets/cinematics/interlude-04-prism-garden.webp', SCOPE_URL).href,
  new URL('assets/cinematics/interlude-05-drowned-causeway.webp', SCOPE_URL).href,
  new URL('assets/cinematics/interlude-06-stormrail-vault.webp', SCOPE_URL).href,
  new URL('assets/cinematics/interlude-07-hourglass-vault.webp', SCOPE_URL).href,
  new URL('assets/cinematics/interlude-09-void-observatory.webp', SCOPE_URL).href,
  new URL('assets/cinder-foundry-arena.webp', SCOPE_URL).href,
  new URL('assets/first-beacon-arena.webp', SCOPE_URL).href,
  new URL('assets/glassreed-mire-arena.webp', SCOPE_URL).href,
  new URL('assets/nighttrace-boss-atlas.webp', SCOPE_URL).href,
  new URL('assets/boss-animations/boss-motion-atlas-a.webp', SCOPE_URL).href,
  new URL('assets/boss-animations/boss-motion-atlas-b.webp', SCOPE_URL).href,
  new URL('assets/enemy-animations/enemy-motion-atlas-a.webp', SCOPE_URL).href,
  new URL('assets/enemy-animations/enemy-motion-atlas-b.webp', SCOPE_URL).href,
  new URL('assets/nighttrace-enemy-atlas.webp', SCOPE_URL).href,
  new URL('assets/nighttrace-pickup-atlas.webp', SCOPE_URL).href,
  new URL('assets/nighttrace-hero-sheet.png', SCOPE_URL).href,
  new URL('assets/nighttrace-title-hero-v2.png', SCOPE_URL).href,
  new URL('assets/nighttrace-wordmark.png', SCOPE_URL).href,
  new URL('assets/hero-animations/hero-charge-runtime.webp', SCOPE_URL).href,
  new URL('assets/hero-animations/hero-fire-runtime.webp', SCOPE_URL).href,
  new URL('assets/hero-animations/hero-walk-runtime.webp', SCOPE_URL).href,
  new URL('assets/character-vfx/hero-material-vfx-atlas-v1-desktop.webp', SCOPE_URL).href,
  new URL('assets/character-vfx/hero-material-vfx-atlas-v1-mobile.webp', SCOPE_URL).href,
  new URL('assets/character-vfx/boss-material-vfx-atlas-v1-desktop.webp', SCOPE_URL).href,
  new URL('assets/character-vfx/boss-material-vfx-atlas-v1-mobile.webp', SCOPE_URL).href,
  new URL('assets/spell-vfx/astral-verdict-v1.webp', SCOPE_URL).href,
  new URL('assets/spell-vfx/astral-verdict-v1-mobile.webp', SCOPE_URL).href,
  new URL('assets/spell-vfx/comet-orbit-v1.webp', SCOPE_URL).href,
  new URL('assets/spell-vfx/comet-orbit-v1-mobile.webp', SCOPE_URL).href,
  new URL('assets/spell-vfx/cinderwake-reaver-v1.webp', SCOPE_URL).href,
  new URL('assets/spell-vfx/cinderwake-reaver-v1-mobile.webp', SCOPE_URL).href,
]

function isCacheable(response) {
  return response && response.status === 200 && (response.type === 'basic' || response.type === 'default')
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

function collectCinematicVoiceFiles(manifest) {
  const allowedStatuses = new Set(['pending-generation', 'partial', 'ready'])
  if (
    !allowedStatuses.has(manifest?.status) ||
    manifest.provider !== 'Google Gemini API' ||
    manifest.model !== 'gemini-3.1-flash-tts-preview' ||
    manifest.promptRevision !== 'nighttrace-campaign-v1' ||
    manifest.set !== 'campaign' ||
    !Number.isInteger(manifest.expectedClipCount) ||
    manifest.expectedClipCount <= 0 ||
    !Array.isArray(manifest.clips) ||
    (manifest.status === 'pending-generation' && manifest.clips.length !== 0) ||
    (manifest.status === 'partial' &&
      (manifest.clips.length === 0 ||
        manifest.clips.length >= manifest.expectedClipCount)) ||
    (manifest.status === 'ready' &&
      manifest.clips.length !== manifest.expectedClipCount)
  ) {
    throw new Error('Invalid cinematic narration manifest')
  }

  const ids = new Set()
  return manifest.clips.map((clip) => {
    if (
      !clip ||
      typeof clip.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clip.id) ||
      ids.has(clip.id)
    ) {
      throw new Error('Invalid or duplicate cinematic narration clip id')
    }
    ids.add(clip.id)
    return new URL(
      `assets/cinematics/audio/campaign/${clip.id}.wav`,
      SCOPE_URL,
    ).href
  })
}

async function precacheCinematicVoices(cache) {
  const response = await fetch(CINEMATIC_VOICE_MANIFEST_URL, { cache: 'reload' })
  if (!isCacheable(response)) {
    throw new Error('Unable to load the cinematic narration manifest')
  }
  await cache.put(CINEMATIC_VOICE_MANIFEST_URL, response.clone())
  const manifest = await response.clone().json()
  const cinematicVoiceFiles = collectCinematicVoiceFiles(manifest)

  if (cinematicVoiceFiles.length === 0) {
    console.info(
      `[NIGHTTRACE] Cinematic narration ${CINEMATIC_VOICE_REVISION}; subtitles remain the explicit fallback.`,
    )
    return
  }

  await Promise.all(cinematicVoiceFiles.map((url) => cache.add(url)))
}

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE)
  await cache.addAll(SHELL_URLS)
  await precacheCinematicVoices(cache)

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
  event.waitUntil(
    precacheShell().then(() => self.skipWaiting()),
  )
})

async function activateServiceWorker() {
  const keys = await caches.keys()
  const staleCacheKeys = keys.filter(
    (key) =>
      key.startsWith(CACHE_PREFIX) &&
      key !== SHELL_CACHE &&
      key !== ASSET_CACHE,
  )

  await Promise.all(staleCacheKeys.map((key) => caches.delete(key)))
  await self.clients.claim()

  if (staleCacheKeys.length === 0) return

  const windowClients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  })
  await Promise.allSettled(
    windowClients.map((client) => {
      try {
        const url = new URL(client.url)
        if (scopedResourcePath(url) === undefined || typeof client.navigate !== 'function') {
          return undefined
        }
        return client.navigate(client.url)
      } catch {
        return undefined
      }
    }),
  )
}

self.addEventListener('activate', (event) => {
  event.waitUntil(activateServiceWorker())
})

async function navigationResponse(request) {
  const cache = await caches.open(SHELL_CACHE)

  try {
    const response = await fetch(request, { cache: 'reload' })
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
    if (resourcePath.startsWith('review/')) {
      event.respondWith(staleWhileRevalidate(request))
      return
    }
    event.respondWith(navigationResponse(request))
    return
  }

  // Media elements issue byte-range requests. A 206 response cannot be safely
  // inserted into CacheStorage as though it were the complete MP3.
  if (request.headers.has('range')) {
    event.respondWith(fetch(request))
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
