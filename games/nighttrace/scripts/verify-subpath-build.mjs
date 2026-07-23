import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distRoot = join(projectRoot, 'dist')
const nestedBase = new URL('https://example.test/H5-Games/nighttrace/')
const manifestUrl = new URL('manifest.webmanifest', nestedBase)

function readText(path) {
  assert(existsSync(path), `Missing build artifact: ${relative(projectRoot, path)}`)
  return readFileSync(path, 'utf8')
}

function readJson(path) {
  return JSON.parse(readText(path))
}

function walkFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    return statSync(path).isDirectory() ? walkFiles(path) : [path]
  })
}

function assertNestedRelative(label, value, base = nestedBase) {
  assert.equal(typeof value, 'string', `${label} must be a string`)
  assert(value.length > 0, `${label} must not be empty`)
  assert(!value.startsWith('/'), `${label} must not be root-absolute: ${value}`)
  assert(!/^[a-z][a-z\d+.-]*:/i.test(value), `${label} must be app-relative: ${value}`)

  const resolvedUrl = new URL(value, base)
  assert.equal(resolvedUrl.origin, nestedBase.origin, `${label} escaped the app origin`)
  assert(
    resolvedUrl.pathname.startsWith(nestedBase.pathname),
    `${label} escaped the nested app path: ${resolvedUrl.pathname}`,
  )
}

assert(existsSync(distRoot), 'dist/ does not exist; run the production build first')

const indexPath = join(distRoot, 'index.html')
const webManifestPath = join(distRoot, 'manifest.webmanifest')
const serviceWorkerPath = join(distRoot, 'sw.js')
const viteManifestPath = join(distRoot, '.vite', 'manifest.json')
const indexHtml = readText(indexPath)
const webManifest = readJson(webManifestPath)
const serviceWorker = readText(serviceWorkerPath)
const viteManifest = readJson(viteManifestPath)
const distFiles = walkFiles(distRoot)
const entryCode = readText(join(distRoot, viteManifest['index.html'].file))

for (const field of ['id', 'start_url', 'scope']) {
  assertNestedRelative(`web manifest ${field}`, webManifest[field], manifestUrl)
}
for (const [index, icon] of webManifest.icons.entries()) {
  assertNestedRelative(`web manifest icon ${index}`, icon.src, manifestUrl)
  const iconUrl = new URL(icon.src, manifestUrl)
  const iconPath = join(distRoot, ...iconUrl.pathname.slice(nestedBase.pathname.length).split('/'))
  assert(existsSync(iconPath), `Missing manifest icon: ${icon.src}`)
}

const htmlRefs = [...indexHtml.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1])
for (const reference of htmlRefs) {
  if (/^(?:https?:|data:|#)/i.test(reference)) continue
  assertNestedRelative(`index reference ${reference}`, reference)
  const resolvedUrl = new URL(reference, nestedBase)
  const localPath = join(
    distRoot,
    ...resolvedUrl.pathname.slice(nestedBase.pathname.length).split('/'),
  )
  assert(existsSync(localPath), `Missing index resource: ${reference}`)
}

for (const [entryName, entry] of Object.entries(viteManifest)) {
  for (const value of [entry.file, ...(entry.css || []), ...(entry.assets || [])]) {
    if (typeof value !== 'string') continue
    assertNestedRelative(`Vite manifest ${entryName}`, value)
    assert(existsSync(join(distRoot, value)), `Missing Vite build file: ${value}`)
  }
}

const sourceMaps = distFiles.filter(
  (path) => path.endsWith('.map') || path.endsWith('.map.gz') || path.endsWith('.map.br'),
)
assert.deepEqual(
  sourceMaps.map((path) => relative(distRoot, path)),
  [],
  'Production sourcemaps must not be emitted',
)

const inspectableFiles = distFiles.filter((path) => /\.(?:html|css|js|json|webmanifest)$/i.test(path))
const forbiddenRootReferences = [
  /["'(`]\/assets\//,
  /["'(`]\/icons\//,
  /["'(`]\/manifest\.webmanifest\b/,
  /["'(`]\/favicon\.svg\b/,
  /["'(`]\/sw\.js\b/,
]
const rootReferenceViolations = []
const sourceMapComments = []

for (const path of inspectableFiles) {
  const content = readFileSync(path, 'utf8')
  if (forbiddenRootReferences.some((pattern) => pattern.test(content))) {
    rootReferenceViolations.push(relative(distRoot, path))
  }
  if (/sourceMappingURL=/i.test(content)) {
    sourceMapComments.push(relative(distRoot, path))
  }
}

assert.deepEqual(rootReferenceViolations, [], 'Root-absolute app references remain in dist')
assert.deepEqual(sourceMapComments, [], 'Production sourceMappingURL comments remain in dist')
assert(
  entryCode.includes('document.baseURI'),
  'Runtime public-asset URLs must resolve from the document/app base',
)
for (const asset of [
  'first-beacon-arena.webp',
  'nighttrace-hero-sheet.png',
  'nighttrace-enemy-atlas.webp',
  'nighttrace-boss-atlas.webp',
]) {
  assert(entryCode.includes(asset), `Entry bundle is missing its UI art reference: ${asset}`)
}
assert(
  !/nighttrace-(?:enemy|boss)-atlas\.png/.test(entryCode),
  'Entry bundle still references removed PNG UI atlases',
)
assert(
  serviceWorker.includes('self.registration.scope') &&
    serviceWorker.includes('scopedResourcePath') &&
    serviceWorker.includes('shellCache.match(request)') &&
    serviceWorker.includes('cache.match(INDEX_URL)'),
  'Service worker must stay in scope, serve precached chunks, and keep updates atomic',
)

const runtimeAssets = [
  'assets/hero-animations/hero-walk-runtime.webp',
  'assets/hero-animations/hero-fire-runtime.webp',
  'assets/hero-animations/hero-charge-runtime.webp',
  'assets/nighttrace-enemy-atlas.webp',
  'assets/nighttrace-boss-atlas.webp',
  'assets/nighttrace-pickup-atlas.webp',
  'assets/nighttrace-hero-sheet.png',
  'assets/first-beacon-arena.webp',
  'assets/glassreed-mire-arena.webp',
  'assets/cinder-foundry-arena.webp',
]

for (const asset of runtimeAssets) {
  assert(existsSync(join(distRoot, asset)), `Missing runtime gameplay asset: ${asset}`)
  assert(
    serviceWorker.includes(`new URL('${asset}', SCOPE_URL).href`),
    `Runtime gameplay asset is not install-precached: ${asset}`,
  )
}

console.log(
  `Subpath release contract passed: ${distFiles.length} files resolve under ${nestedBase.pathname}; no production sourcemaps or root-absolute app references.`,
)
