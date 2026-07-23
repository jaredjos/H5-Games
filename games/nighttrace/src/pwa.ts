const UPDATE_EVENT = 'nighttrace:pwa-update'
const UPDATE_CHECK_INTERVAL = 15 * 60 * 1000

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
}

function canRegisterServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return false
  if (window.isSecureContext) return true
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
}

function getAppBaseUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.href)
}

function scopedResourcePath(url: URL, appBaseUrl: URL) {
  if (url.origin !== appBaseUrl.origin || !url.pathname.startsWith(appBaseUrl.pathname)) {
    return undefined
  }
  return url.pathname.slice(appBaseUrl.pathname.length)
}

function loadedSameOriginAssets(appBaseUrl: URL) {
  const urls = new Set<string>()
  for (const entry of performance.getEntriesByType('resource')) {
    const url = new URL(entry.name, window.location.href)
    const resourcePath = scopedResourcePath(url, appBaseUrl)
    if (resourcePath === undefined) continue
    if (
      resourcePath.startsWith('assets/') ||
      resourcePath.startsWith('icons/') ||
      resourcePath === 'favicon.svg' ||
      resourcePath === 'manifest.webmanifest'
    ) {
      urls.add(url.href)
    }
  }
  return [...urls].slice(0, 64)
}

function notifyUpdate(registration: ServiceWorkerRegistration) {
  window.dispatchEvent(
    new CustomEvent(UPDATE_EVENT, {
      detail: { registration },
    }),
  )
}

async function register() {
  try {
    const appBaseUrl = getAppBaseUrl()
    const registration = await navigator.serviceWorker.register(
      new URL('sw.js', appBaseUrl).href,
      {
        scope: appBaseUrl.href,
        updateViaCache: 'none',
      },
    )

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyUpdate(registration)
    }

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          notifyUpdate(registration)
        }
      })
    })

    const readyRegistration = await navigator.serviceWorker.ready
    readyRegistration.active?.postMessage({
      type: 'CACHE_URLS',
      urls: loadedSameOriginAssets(appBaseUrl),
    })

    let lastUpdateCheck = Date.now()
    const checkForUpdate = () => {
      if (document.hidden || !navigator.onLine) return
      const now = Date.now()
      if (now - lastUpdateCheck < UPDATE_CHECK_INTERVAL) return
      lastUpdateCheck = now
      void registration.update().catch(() => undefined)
    }

    window.addEventListener('online', checkForUpdate)
    document.addEventListener('visibilitychange', checkForUpdate)
  } catch (error) {
    console.warn('[NIGHTTRACE] Offline support could not be enabled.', error)
  }
}

export function registerNighttraceServiceWorker() {
  if (!canRegisterServiceWorker()) return

  const startRegistration = () => {
    const idleWindow = window as IdleWindow
    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(() => void register(), { timeout: 2500 })
    } else {
      window.setTimeout(() => void register(), 1)
    }
  }

  if (document.readyState === 'complete') {
    startRegistration()
  } else {
    window.addEventListener('load', startRegistration, { once: true })
  }
}
