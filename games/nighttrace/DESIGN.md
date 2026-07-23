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

## Visual language

- Obsidian and navy terrain with wet reflections and shattered ivory architecture.
- Cyan for player energy and XP, solar gold for rewards, coral for danger, violet for shadow.
- Painterly 2.5D assets with angular glass-and-brass code-native UI.
- Enemy silhouettes remain readable beneath allied VFX; saturated coral is reserved for threats.

## Accessibility and performance

The game supports keyboard, pointer, and touch input; reduced flash; reduced motion and shake; high-contrast motes; optional damage numbers; Auto Pulse; separate master, music, and effects volume controls; capped render resolution; pooled combat entities; and a fixed-step simulation. Drafts pause combat, the page pauses when hidden, and CSS also respects the operating-system reduced-motion preference.

## QA acceleration

In the Vite development server only, adding `?qa` to the URL accelerates simulation and guarantees early upgrade and boss checkpoints. It is a testing aid, not a player-facing difficulty option, and is disabled by production builds.
