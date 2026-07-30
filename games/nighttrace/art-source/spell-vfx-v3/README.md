# NIGHTTRACE premium spell VFX v3 sources

These eight original source sheets were generated for NIGHTTRACE on 2026-07-30
and are intentionally kept outside the shipped runtime bundle. The build script
at `scripts/build-premium-spell-vfx.py` isolates, trims, scales, and packs them
into the optimized alpha-WebP atlases under
`public/assets/spell-vfx/premium/`.

## Sheet contract

- columns: Spell Rank I, II, III, IV, V, Awakened
- row 1: primary/cast material
- row 2: active/travel material
- row 3: impact/release material
- source background: black for deterministic luminance-based isolation
- runtime output: one 6x3 material atlas per spell and one shared 6x8
  spell-by-rank projectile atlas, each with desktop and mobile LODs

## Creative direction

- `helio-lance-v3-source.png`: bone-white and solar-gold astral spear light,
  restrained blue-white refraction, increasingly complex crowned lance forms
- `crescent-array-v3-source.png`: moon-silver crescent blades, cold cyan vapor,
  orbital density that grows into a black-moon awakened formation
- `arc-choir-v3-source.png`: violet-white sigil nodes and branching electricity,
  expanding from a compact choir into a celestial lattice
- `rift-seeds-v3-source.png`: teal void seeds, dark gravity cores, mineral
  fragments, and an awakened event-horizon garden
- `comet-swarm-v3-source.png`: ember-orange comet heads, smoke-rich trails, and
  a progressively broader perihelion hunting fan
- `graveglass-spires-v3-source.png`: obsidian crystal spires with crimson inner
  fractures, physical rupture debris, and a cathedral-scale awakened cluster
- `mirror-bow-v3-source.png`: ice-silver refracted arrows, mirror fragments, and
  increasingly dense prismatic execution volleys
- `eclipse-harrow-v3-source.png`: dark-magenta gothic gates, smoky execution
  lanes, and an awakened cathedral harrow

The sheets are presentation-only. Damage, cadence, targeting, collision, and
hitbox behavior remain authored in game code.
