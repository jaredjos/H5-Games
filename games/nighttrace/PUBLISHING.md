# NIGHTTRACE publishing

## Release identity

- Repository path: `games/nighttrace`
- H5 runtime: React + TypeScript + PixiJS + Vite
- Current web release: `v1.7.2`
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

Release archives and executable launchers are generated artifacts and are
excluded from source control.
