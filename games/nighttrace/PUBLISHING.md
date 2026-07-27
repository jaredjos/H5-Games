# NIGHTTRACE publishing

## Release identity

- Repository path: `games/nighttrace`
- H5 runtime: React + TypeScript + PixiJS + Vite
- Current web release: `v1.10.0`
- Latest tagged archive release: `nighttrace-v1.1.0`
- Previous frozen release: `nighttrace-v1.0.0`
- Save key: `nighttrace.save.v1`

## Validation gate

Run the following from this directory before packaging:

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
pnpm verify:build
```

The release is acceptable only when the complete current unit-test suite passes,
lint exits cleanly, the subpath verifier passes, no production source maps are
emitted, and Vite produces `dist/index.html`.

The v1.5.0 mode and hostile-presentation gate additionally requires:

- all ten Lab arenas and bosses visible and selectable
- Solo, Combined, Mastered, Final, manual rank, awakening, and Trace controls
- infinite Lab vitality and zero Lab progression writes
- strict sequential Boss Trial unlocks with no campaign mutations
- boss-only encounter gates that begin audio from a player gesture
- visible restrained horde accents and prominent hostile boss specials
- 844×390 landscape combat and mode screens without document overflow
- 390×844 portrait menus plus a paused landscape combat gate
- no browser console warnings or errors

The v1.5.2 sovereign-animation gate additionally requires:

- all ten bosses have distinct immutable motion profiles
- each profile produces readable idle and locomotion silhouettes
- normal contact attacks visibly pass through wind-up, release, and recovery
- each level-specific special produces a distinct body pose and hostile VFX accent
- dynamic anchors, squash/stretch, lean, recoil, and afterimages remain bounded
- reduced-motion mode preserves every required gameplay telegraph
- representative first- and final-boss encounters animate in live PixiJS combat
- the live browser console remains free of warnings and errors

The v1.6.0 remote-power, pickup, and music gate additionally requires:

- Graveglass Spires reports `graveglass-spires`, zero concentric bands, and at
  least one live effect in every showcase state
- Eclipse Harrow reports `eclipse-harrow`, zero concentric bands, and at least
  one live effect in every showcase state
- Graveglass selects a densest remote cluster and scales through 2 / 3 / 4 / 6
  spires; Harrow predicts lanes and scales through 1 / 2 / 3 / 4 cuts
- pattern tests prove that overlapping strikes damage each target once per cast
- deterministic 1440x900 captures distinguish Solo, Combined, Mastered, and
  Final; both Final states remain legible at 844x390
- Dawnheart, Gravestar, and Pulse Core project persistent tapered vertical
  beacons without obscuring boss telegraphs
- original ambient and sovereign music assets load through lifecycle-safe
  playback, crossfade on boss entry, and degrade to the procedural fallback if
  a streamed asset cannot start
- the runtime capture report, public contact sheets, capture manifest, and
  Combat Systems Codex are regenerated from the stable v1.6.0 build
- no supplied reference frame, artwork, or audio is included in the package

The v1.7.2 remote-power presentation-parity gate additionally requires:

- Graveglass Spires and Eclipse Harrow consume immutable presentation-only
  profiles across Basic, Upgraded, Mastered, and Final
- additive hostile underglow remains below the protected hero, boss, and
  foreground actor layers
- cosmetic debris and shimmer are deterministic and never consume simulation
  randomness or alter damage, cooldown, targeting, or collision state
- the standalone HTTPS choreography review autoplays the authored material
  reveals without becoming part of the gameplay bundle

The v1.8.0 authored-runtime gate additionally requires:

- live Graveglass strikes use the approved obsidian/crimson material texture,
  bottom-anchored rise animation, impact hold, and clean decay
- live Eclipse lanes raise authored hostile gothic gates, with a distinct
  cathedral focal structure reserved for the Final formation
- desktop and mobile texture LODs decode as valid alpha WebP images
- authored structures render beneath hordes, bosses, and the protected hero;
  no spell code mutates actor opacity or parents actors beneath effect layers
- every pose is derived from fixed spell-local time and deterministic cosmetic
  seeds, with no free-running animation clock or simulation-RNG consumption
- the old opaque procedural spire/gate bodies no longer compete with the
  authored structures; ground fissures, lanes, shards, and additive impacts
  remain native and target-aware
- damage, cooldown, target selection, hit de-duplication, and collision tests
  remain unchanged

The v1.9.0 grounded-hostile-VFX gate additionally requires:

- circular and directional hostile warnings use authored transparent
  rubble/scorch materials rather than stroked rings, polygons, center rays,
  parallel rails, radial ticks, or segmented geometry
- Graveglass keeps the approved crystal silhouette while its duplicate
  procedural fissures, connector lines, diamond plates, and hit starbursts are
  absent from live combat
- Eclipse keeps its authored gates and Final cathedral while its duplicate lane
  edges, center cuts, and fracture strokes are absent from live combat
- hostile warning materials render in a dedicated ground layer beneath weapon
  structures, hordes, bosses, projectiles, and the protected hero
- boss attack animation remains readable through body motion, contact shadow,
  displaced dust, and ash rather than local antler or signature line systems
- desktop and mobile ground-field and ground-lane bundles decode as valid
  alpha WebP images; mobile assets are materially smaller
- warning duration, collision geometry, damage, targeting, cooldown, and boss
  pattern scheduling remain unchanged

## Release archives

The Windows archive contains:

```text
NIGHTTRACE Launcher.exe
PLAY NIGHTTRACE.cmd
README.md
LICENSE.txt
THIRD_PARTY_NOTICES.txt
dist/
```

The web/mobile archive contains the deployable contents of `dist/` at its root
plus `LICENSE.txt`, `THIRD_PARTY_NOTICES.txt`, and a short deployment readme.
Deploy it over HTTPS at a domain root or nested path. Keep the launcher beside
`dist/`; it serves the same build only on the desktop loopback address.

## Versioning

- `nighttrace-v1.0.0`: frozen desktop/browser release.
- `nighttrace-v1.1.0`: mobile/PWA hardening release.
- `v1.1.1`: hosted web balance and touch-HUD update.
- `v1.2.0`: landscape draft, audio, support-relic, and ten-pattern boss update.
- `v1.3.0`: minute-based horde curve and adaptive boss-durability update.
- `v1.3.1`: runtime documentation and enemy/boss motion-readability update.
- `v1.4.0`: complete eight-weapon VFX overhaul and refreshed runtime evidence.
- `v1.5.0`: public Combat Lab, progressive Boss Trials, hostile motion/VFX hierarchy, and expanded mobile QA.
- `v1.5.1`: former area-power clarity experiment, rapid-fire motion continuity, and refreshed runtime proofs.
- `v1.5.2`: ten-signature sovereign choreography with distinct idle, locomotion, melee, and level-specific special-action VFX.
- `v1.6.0`: Graveglass Spires, Eclipse Harrow, remote-world targeting, rare-drop light shafts, original layered music, and refreshed deterministic evidence.
- `v1.7.0`: experimental hero and sovereign material-VFX pass.
- `v1.7.1`: full-resolution actor rescue, protected actor layering, bounded maximum-load effects, hostile boss atmosphere, and desktop/DPR-3 mobile visual validation.
- `v1.7.2`: Graveglass Spires and Eclipse Harrow presentation parity with stage-scaled authored material profiles, layered hostile underglow, deterministic cosmetic debris, and unchanged combat simulation.
- `v1.8.0`: approved Graveglass and Eclipse material animation integrated into real PixiJS combat with alpha-textured structures, deterministic strike-local choreography, actor-safe layering, and mobile LODs.
- `v1.9.0`: grounded material warnings replace hostile diagram graphics and duplicate final-spell vectors with rubble, scorch, ash, dust, and restrained embedded embers below all actors.
- `v1.10.0`: all hero-power rings, radial ticks, line bursts, outlined gates, decorative rails, and generic diamond fragments are replaced by authored ground damage, smoke, ash, grit, and physical material cues without changing collision or balance.

Release archives and executable launchers are generated artifacts and are
excluded from source control.
