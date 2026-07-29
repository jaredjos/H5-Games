NIGHTTRACE v1.17.0 bundled runtime documentation

NIGHTTRACE_Combat_Systems_Codex.pdf
  Legacy v1.6 player-facing and implementation-derived reference for spell states,
  paired modules, Trace Mods, timed support relics, all ten boss patterns,
  difficulty logic, original music, mobile readiness, and source anchors.

upgrade-states-01.png
  Legacy v1.4 PixiJS gameplay frames for Helio Lance, Crescent Array, Arc Choir,
  and Rift Seeds at Solo, Combined, Mastered, and Final.

upgrade-states-02.png
  Legacy v1.4/v1.6 PixiJS gameplay frames for Comet Swarm, Graveglass Spires,
  Mirror Bow, and Eclipse Harrow at Solo, Combined, Mastered, and Final.

capture-manifest.json
  State definitions, local-only reproduction routes, renderer timing, exact
  dimensions, file sizes, SHA-256 hashes, and source versions for every frame.
  Graveglass Spires and Eclipse Harrow are v1.6.0 recaptures; the other six
  unchanged spell plates retain their verified v1.4.0 runtime frames.
  The v1.17.0 live renderer and its shared spell visual recipe are authoritative.

Graveglass Spires and Eclipse Harrow are remote-world powers. They do not follow
the bearer, use concentric damage bands, or apply repeated damage where their
presentation geometry overlaps. Timed support relics use persistent tapered
vertical beacons to remain visible through dense combat.

The v1.10.0 live runtime removes concentric/dotted rings, radial ticks,
starbursts, rune wheels, outlined gates, decorative rails, and generic
diamond debris from all hero powers. Authored fractured stone, smoke, ash,
grit, physical fragments, and localized material light replace those
diagrammatic overlays. Combat timing and collision geometry are unchanged.

The v1.11.0 live runtime adds authored idle, two-contact locomotion, attack
windup, and special-release poses to every sovereign silhouette. Quadruped
bosses use alternating four-leg contact poses. Hostile warnings use compressed
ground material, smoke, pressure, rubble, and boss-specific restrained tints
instead of rings, grids, rails, rays, or hard polygon outlines. All eight
spells enter the campaign draft pool immediately; each descent includes three
free refreshes, and every spell follows one normalized connected-DPS budget.

The v1.12.0 delivery pass forces old cache-first clients onto the current
runtime, snaps irregular boss-atlas grids to whole-pixel cells, centers every
gameplay dialog with symmetric safe-area gutters, exposes all seven alternate
starting powers across the opening choice and three free refreshes, extends the
base trace by 40%, and awards Pulse only after a valid trace encloses an active
enemy.
