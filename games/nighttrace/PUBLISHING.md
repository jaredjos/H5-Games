# NIGHTTRACE publishing

## Release identity

- Repository path: `games/nighttrace`
- H5 runtime: React + TypeScript + PixiJS + Vite
- Current web release: `v1.20.0`
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
- licensed, mastered supplied ambient and sovereign music assets load through lifecycle-safe
  playback, crossfade on boss entry, and degrade to the procedural fallback if
  a streamed asset cannot start
- the runtime capture report, public contact sheets, capture manifest, and
  Combat Systems Codex are regenerated from the stable v1.6.0 build
- no supplied reference frame or artwork is included in the package; approved
  music sources appear only as mastered runtime derivatives

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

The v1.16.0 all-boss grounded-particle gate additionally requires:

- every boss field, lane, and projectile-destination warning carries
  deterministic smoke, grit, and restrained cinders
- desktop, mobile, and reduced-flash particle budgets stay explicitly bounded
  while preserving warning readability
- hostile warnings contain no line, ring, grid, radial-tick, polygon, or
  diagrammatic attack-zone primitives
- warning geometry, collision, damage, targeting, cooldown, and encounter
  scheduling remain unchanged
- the rectangular hero-sanctum quad and shader are absent; the small filtered
  hero ground shadow remains beneath the actor

The v1.16.1 renderer-artifact hotfix additionally requires:

- no hero ground-material plate, filtered white-texture actor shadow, or
  filtered boss-atmosphere surface is present in the runtime
- native ellipse contact shadows retain grounding without custom filter quads
- every boss and horde atlas is a divisible 5x3 grid of isolated 384 px alpha
  cells; the audited pose content keeps at least a 10 px transparent gutter
- boss fields, lanes, and destinations guarantee multiple readable cinders
  plus less-blurred smoke and larger grit within bounded budgets
- elite/ranged horde fields, lanes, and projectile destinations use the same
  physical particle language at deliberately lower prominence
- collision, damage, warning duration, targeting, and encounter scheduling
  remain unchanged

The v1.16.2 revive/facing hotfix additionally requires:

- one accepted revive restores exactly 50% of maximum vitality while retaining
  the existing shield, sanctuary, grace-period, and encounter-state rules
- every Sovereign derives its horizontal visual facing from the live bearer
  position during intro, idle, locomotion, windup, and release
- the left-authored Railjaw/Furnace atlas row is corrected before runtime
  mirroring; no collision, velocity, damage, or attack timing changes
- `review/hostile-boundary/` remains the animated visual reference for the
  approved white-spray perimeter treatment

The v1.16.3 live hostile-boundary gate additionally requires:

- every boss and elite field, lane, and projectile destination carries short,
  broken bone-white/silver filaments plus independently drifting motes
- the boundary treatment remains textured, irregular, and physically broken;
  it never forms a continuous outline, dotted ring, grid, radial tick system,
  polygon fan, or line burst
- three-, five-, and eight-footprint signatures allocate boundary particles
  fairly, reserving a visible share for every active footprint before assigning
  extras so later circles cannot be starved by earlier ones
- the separate boundary budget is capped at 160 particles on desktop and 112
  on mobile, enough to reserve at least one filament and one mote for every
  footprint at the runtime's maximum warning populations; reduced-flash mode
  keeps the same coverage while lowering emission and motion
- deterministic seeds keep each footprint's filaments and motes stable across
  identical runs without consuming simulation randomness
- warning radius, lane width and length, collision, damage, targeting,
  scheduling, and projectile destinations remain unchanged

The v1.20.0 campaign-presentation and combat-readability gate additionally
requires:

- cinematic score and narration are primed by the initiating player gesture,
  begin without a delayed visual lead, and remain synchronized through pause,
  resume, skip, and scene completion
- the prologue, nine sector interludes, and level-ten climax are all directly
  replayable from Combat Lab, with expressive speaker portraits accompanying
  every dialogue beat
- hero hit feedback retains the source of contact, projectile, field, lane, or
  boss damage; compact color-coded combat text stays legible under horde load
- hostile fields, lanes, and projectile destinations keep their broken,
  grounded material language while brighter filaments and motes improve
  contrast without changing geometry
- the deliberately forgiving, foot-centered hero hitbox is explicit and
  covered by focused tests rather than inferred from the full character art
- Dawnward Aegis remains hard-gated to Combat Lab and validates ranks I–V plus
  its Awakened state without entering Campaign or Boss Trial draft pools
- the isolated v1.18.0 visual experiment retains separate source, storage,
  cache, service-worker scope, and selector link

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
- `v1.11.0`: authored five-pose sovereign atlases add idle, two-contact locomotion, windup, and release silhouettes; quadrupeds visibly alternate four-leg contacts; grounded physical hostile warnings replace diagrammatic telegraphs; all eight weapons are available immediately with three free refreshes and normalized connected DPS; overlays share a centered safe-area wrapper.
- `v1.12.0`: network-first navigation and automatic stale-client replacement deliver the current runtime; rounded atlas cells prevent pose bleed; every modal uses symmetric safe-area centering; the fresh three-card draft plus its free refresh cycle exposes all eight starting powers; base trace memory is 40% longer and only successful enemy enclosures charge Pulse.
- `v1.13.0`: three normalized supplied scores replace the retired procedural music; the global difficulty multiplier returns to baseline; boss repertoires expand from level 2 and include visible fixed-destination ranged attacks; crimson/violet warning chroma remains embedded in physical ground material; all six horde species use authored five-pose motion sheets, with ranged specialists in later sectors.
- `v1.14.0`: one free Campaign/Boss Trial revive restores 35% vitality without resetting encounter state; two conditional 10% Dawnheart windows replace the larger adaptive heal budget; active hearts are removed on revive, post-revive healing is locked for 45 seconds, and all enemy, boss, spawn, and hazard pressure remains at the v1.13 baseline.
- `v1.15.0`: original XP and normal-kill Pulse charge paths return without weakening valid-enclosure rewards; NastelBom's supplied boss score replaces the former boss track through normalized full/compact derivatives; a dedicated 1024×1536 transparent title hero replaces the stretched 627×627 atlas cell.
- `v1.16.0`: deterministic smoke, grit, and restrained cinders give every boss field, lane, and projectile-destination warning material depth across bounded desktop, mobile, and reduced-flash budgets; no diagrammatic primitives or gameplay geometry change; the rectangular hero-sanctum quad is removed while the small filtered ground shadow remains.
- `v1.16.1`: removes every remaining broad normal-blended/custom-filter actor-ground surface, isolates all 60 boss/horde pose cells behind transparent gutters, strengthens boss warning smoke/grit/cinders, and adds restrained physical particles to elite/ranged horde warnings without changing combat mechanics.
- `v1.16.2`: revives restore 50% vitality, every Sovereign faces the live bearer with authored-row correction, and the animated hostile-boundary reference is published for final approval.
- `v1.16.3`: the approved broken bone-white/silver boundary treatment enters live PixiJS combat for every boss and elite field, lane, and projectile destination; deterministic fair-share allocation keeps three-, five-, and eight-footprint signatures readable within dedicated desktop, mobile, and reduced-flash budgets without changing gameplay geometry.
- `v1.16.4`: Boss Trials now begin independently of media playback, reject pre-encounter pause input, move an overlapping Sovereign outside the one-revive sanctuary, focus the newly unlocked crown after a first clear, and report the defeated Sovereign correctly; all hero-originating direct spells launch from the authored Dawncaster position while remote Graveglass and Eclipse targeting remains unchanged.
- `v1.19.0`: The Last Light adds a voiced prologue, nine first-clear interludes, a level-ten climax, cinematic controls and settings, and the replayable Dawn Archive without changing combat balance or repeat-clear flow.
- `v1.20.0`: reliable zero-lag audio/cinematic startup, all eleven scenes in Combat Lab, expressive dialogue portraits, source-aware damage feedback and compact colored combat text, brighter grounded hostile boundaries, an explicit test-covered forgiving hero hitbox, and the Lab-only Dawnward Aegis ranks I–V plus Awakened.

Release archives and executable launchers are generated artifacts and are
excluded from source control.
