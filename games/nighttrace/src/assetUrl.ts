const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export function appAssetUrl(path: string) {
  const normalizedPath = path.replace(/^\.?\//, '')
  if (typeof document === 'undefined') return `${baseUrl}${normalizedPath}`
  return new URL(normalizedPath, new URL(baseUrl, document.baseURI)).href
}

export function installAssetCssVariables() {
  const root = document.documentElement
  root.style.setProperty(
    '--asset-first-beacon',
    `url("${appAssetUrl('assets/first-beacon-arena.webp')}")`,
  )
  root.style.setProperty(
    '--asset-campaign-disk',
    `url("${appAssetUrl('assets/campaign-disk-background.webp')}")`,
  )
}
