# NIGHTTRACE design brief

## Hook

The player carries the last living star through a world drowned in shadow. Moving paints a short-lived luminous trail. Closing the recent trail forms an attack circuit through the horde; a fully charged Trace Pulse is the wider emergency release. New players can kite while weapons auto-fire, while skilled players draw deliberate shapes through dense formations.

## Run arc

1. Movement and the first meaningful draft occur within seconds.
2. XP motes create risk-reward collection routes.
3. Three-choice drafts pause combat and advance a four-weapon/four-module build.
4. Weapons climb through five ranks and awaken when their aligned module is installed.
5. Escalating horde pressure, timed hazards, tactical pickups, and readable bosses punctuate each run.
6. Dawn Shards and mastery seals feed a compact, freely refundable Astrarium.

Runs are deliberately compressed: the campaign begins at 4:00 and grows to 7:30. Each victory unlocks the next sector; defeats still bank Dawn Shards without skipping campaign progression. The ten-sector sequence is:

1. First Beacon - 4:00 - Gloam Stag
2. Glassreed Mire - 4:30 - Mire Cantor
3. Shattered Arcade - 5:00 - Railjaw Prime
4. Prism Garden - 5:00 - Mirror Matron
5. Drowned Docks - 5:30 - Tide Apostle
6. Stormrail - 6:00 - Storm Engine
7. Hourglass Vault - 6:00 - Chronophage
8. Cinder Foundry - 6:30 - Furnace Titan
9. Void Observatory - 7:00 - The Cartographer
10. Crown of Dawn - 7:30 - The Sun-Eater

## Progression contract

- A run holds at most four weapons, four modules, and three Trace Mods.
- Bright Draft unlocks one upgrade reroll per run; smart drafting favors owned weapons, aligned modules, ready awakenings, and recovery under pressure.
- A sector offers clear, Trace-loop, and Aegis-chain mastery seals. Newly earned seals add bonus Dawn Shards.
- The Astrarium has ten prerequisite-linked nodes with rank caps and a full-cost refund.
- The versioned browser save records relit sectors, mastery, Dawn Shards, weapon patterns, Astrarium ranks, and settings. It uses local storage only.

Boss Trials is an isolated sequential progression track: boss 1 starts open,
and only defeating the next unbeaten boss opens another. Its curated builds and
small shard stipends do not mutate campaign sectors, mastery, or weapon unlocks.

Combat Lab is intentionally non-progression. It can combine any of the ten
arenas, ten bosses, eight weapons, eight paired modules, awakenings, and up to
three Trace Mods. The player can run a boss isolate or full sector with
unlimited vitality; no Lab result writes rewards or progression.

## Visual language

- Obsidian and navy terrain with wet reflections and shattered ivory architecture.
- Cyan for player energy and XP, solar gold for rewards, coral for danger, violet for shadow.
- Painterly 2.5D assets with angular glass-and-brass code-native UI.
- Enemy silhouettes remain readable beneath allied VFX; saturated coral is reserved for threats.
- World-anchored powers do not orbit or follow the bearer. Graveglass Spires
  erupts beneath the densest remote cluster; Eclipse Harrow cuts predicted
  enemy lanes from remote nightglass gates. Each scales through four distinct
  formations, avoids concentric clutter, and applies damage only once per target
  even when presentation geometry overlaps.
- Every major power owns a distinct origin, path, target, and decay grammar.
  Anticipation reveals the landing area, impact receives peak contrast, and
  non-persistent effects decay rapidly so boss telegraphs remain legible.
- Valuable support relics use a persistent tapered heaven-to-ground shaft and a
  broken landing rune. The beam is a navigation landmark, not a damage zone.
- Horde motion accents are low-alpha and LOD-capped; boss specials may dominate
  the frame through crimson/violet seals, segmented rings, streak echoes, and
  impact cores.
- Hostile attacks use a deterministic gather → release → aftershock envelope.
  HyperFrames motion rules inform the timing language; native PixiJS owns the
  interactive runtime.

## Reference-analysis boundary

The v1.6.0 presentation pass was informed by an internal analysis of a supplied
442.19-second, 560x1312 gameplay recording at approximately 57.8 fps. The study
identified four reusable design rules: distinguish every power by its
origin/path/target/decay sequence; hold a vertical shaft over valuable drops;
compress anticipation into a decisive impact and rapid decay; and identify
bosses through geometry, directional telegraphs, and charge lanes.

Audio measurements were used only to understand contrast: the gameplay pulse
was estimated near 136 BPM (68 BPM half-time), with -26.5 LUFS integrated
loudness, 10.3 LU loudness range, -4.3 dBFS true peak, and a gameplay spectral
centroid around 2.3-2.9 kHz versus roughly 1.1 kHz in menus. NIGHTTRACE does not
copy or ship any reference asset or audio. Its layered dungeon and sovereign
music, artwork, timing, and PixiJS effects are original.

## Accessibility and performance

The game supports keyboard, pointer, and touch input; reduced flash; reduced motion and shake; high-contrast motes; optional damage numbers; Auto Pulse; separate master, music, and effects volume controls; capped render resolution; pooled combat entities; and a fixed-step simulation. Drafts pause combat, the page pauses when hidden, and CSS also respects the operating-system reduced-motion preference.

## QA acceleration

In the Vite development server only, adding `?qa` to the URL accelerates simulation and guarantees early upgrade and boss checkpoints. It is a testing aid, not a player-facing difficulty option, and is disabled by production builds.
