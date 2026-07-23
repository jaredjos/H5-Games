# NIGHTTRACE

**Draw the path. Burn the horde.**

NIGHTTRACE is an original browser horde-survival game built with React, TypeScript, Vite, and PixiJS. Auto-attacking weapons keep the controls approachable; every step paints a luminous trace, and closing a loop turns movement itself into a weapon.

## Play online

[Launch NIGHTTRACE over HTTPS](https://jaredjos.github.io/H5-Games/nighttrace/)

## Release lineage

- `v1.0.0` — original desktop/browser release
- `v1.1.0` — mobile-ready release with installable offline play, safe-area-aware touch UI, responsive portrait/landscape layouts, deployment-relative hosting, lifecycle-safe audio, and substantially lighter runtime art
- `v1.1.1` — streamlined touch HUD with direct arena steering and a global 10% hostile-pressure increase across all sectors

## One-click Windows start

Double-click **`NIGHTTRACE Launcher.exe`** in this folder. It starts the
prebuilt game, opens it in your default browser, and does not require Node,
pnpm, an install step, or a terminal command.

Keep the small NIGHTTRACE launcher window open while playing. Close that
window or press `Ctrl+C` to stop the local game server. `PLAY NIGHTTRACE.cmd`
is included as an equivalent double-click shortcut to the launcher.

## Mobile install and offline play

Deploy the `dist` folder over HTTPS at either a domain root or a nested path
such as `/H5-Games/nighttrace/`, open it in a mobile browser, and use the
browser's **Add to Home Screen** or **Install app** action. The installed game
requests a landscape, fullscreen-capable presentation and includes standard,
maskable, and Apple touch icons. Build output uses deployment-relative asset,
manifest, and service-worker URLs, so no path rewriting is required.

The versioned service worker caches the app shell, generated Vite chunks, and
the complete optimized gameplay-art set during installation. After the first
online load finishes, all ten sectors can start and render offline rather than
only revisiting screens that happened to be opened before disconnecting. A
newly downloaded worker waits for existing game tabs to close before taking
over, avoiding a mid-run reload.

The Windows launcher is intentionally bound to this PC's loopback address; it
is a desktop quick start, not a phone-accessible LAN server.

### Mobile submission notes

The web package is release-ready for HTTPS static hosts and can also be wrapped
for Android or iOS with a standards-based webview shell. Before store
submission, replace the generic wrapper identity with the final publisher,
bundle ID, signing credentials, store artwork, privacy declarations, and
device-specific screenshots. The game itself does not collect account data,
show ads, or make network calls after its assets have been cached.

## Developer start

Install dependencies once, then start the Vite development server:

```powershell
pnpm install
pnpm dev --host 127.0.0.1
```

Then open `http://127.0.0.1:5173/`.

## Controls

- `WASD` or arrow keys - move
- `Space` - release Trace Pulse when fully charged
- `1`, `2`, `3` - choose one of the paused upgrade cards
- `Esc` or `P` - pause or resume a run
- `M` - mute or restore the master volume
- Pointer/touch drag in the arena - steer with the virtual movement stick
- Touch controls - use the on-screen Pulse and pause buttons

Weapons fire automatically. The movement trace is the second combat layer: close a circuit through a pack, then use the fully charged Pulse when the horde closes in.

## Combat animation and sound

The bearer uses hand-authored sprite animation: an eight-pose locomotion cycle,
a six-pose Dawncaster discharge with cooldown-synchronised anticipation and
recoil, and a six-pose solar-ready sequence for radial casts and Trace Pulse.
The pose controller locks every drawing to one foot baseline, mirrors around the
body root, and freezes with the fixed-step simulation whenever play is paused.
Every Nightborn species and all ten sovereign bosses retain their dedicated
procedural motion profiles for locomotion, attacks, impacts, entrances, phase
changes, and defeats. Reduced-motion mode keeps gameplay telegraphs while
softening nonessential sway, recoil, and afterimages.

Each weapon now has a distinct luminous projectile silhouette and pooled trail
language. Boss arrivals shift the ambient score into a heavier combat state,
phase changes and attacks receive restrained stingers, and every run ends on a
dedicated victory or defeat cue that finishes before the results screen appears.

## Campaign

Ten data-driven sectors run from four to seven and a half minutes. Each adds enemy combinations, hazards, and a named boss while the health and spawn multipliers rise along a deliberate curve. Release `v1.1.1` applies one global `1.10` pressure multiplier to spawn intensity, enemy and boss health, and incoming damage in every sector, preserving the shape of the original curve while making the full campaign 10% more demanding.

| # | Sector | Time | Boss | First-clear unlock |
| ---: | --- | ---: | --- | --- |
| 1 | First Beacon | 4:00 | Gloam Stag | Crescent Array |
| 2 | Glassreed Mire | 4:30 | Mire Cantor | Arc Choir |
| 3 | Shattered Arcade | 5:00 | Railjaw Prime | Rift Seeds |
| 4 | Prism Garden | 5:00 | Mirror Matron | Comet Swarm |
| 5 | Drowned Docks | 5:30 | Tide Apostle | Ash Halo |
| 6 | Stormrail | 6:00 | Storm Engine | Mirror Bow |
| 7 | Hourglass Vault | 6:00 | Chronophage | Null Bell |
| 8 | Cinder Foundry | 6:30 | Furnace Titan | Masterwork module cache |
| 9 | Void Observatory | 7:00 | The Cartographer | Astrarium sigil |
| 10 | Crown of Dawn | 7:30 | The Sun-Eater | Crown of Dawn relic |

Three-card drafts pause the action. A run can carry up to four weapons, four aligned modules, and three Trace Mods. Weapons have five ranks; mastering a weapon while holding its aligned module exposes its awakening. The Bright Draft Astrarium node unlocks one reroll per run, and the draft system keeps recovery or another actionable choice available when a build is saturated.

Victories relight the next sector, recover weapon patterns, and can earn three mastery seals: clear, Trace, and Aegis. Failed runs do not unlock the next sector, but they still return earned and performance-based Dawn Shards.

## Astrarium and saves

Dawn Shards fund the ten-node Astrarium, a prerequisite-linked constellation of persistent upgrades. Nodes have explicit rank caps, and **Refund all** returns the full shard investment so a build can be reconfigured freely.

Campaign progress, mastery, weapon unlocks, Astrarium ranks, and settings are stored locally in the browser under the versioned `nighttrace.save.v1` save. There is no account or remote backend. **Erase progress** clears campaign progression while preserving the current accessibility and audio settings.

## Accessibility

The Settings screen includes independent master, music, and effects volume controls plus reduced flash, reduced motion and shake, high-contrast motes, damage-number visibility, and Auto Pulse. The interface supports keyboard and touch input, pauses drafts before a choice, respects the system reduced-motion preference, and automatically pauses simulation when the page is hidden.

## Commands

```powershell
pnpm build
pnpm verify:build
pnpm test
pnpm lint
pnpm preview
```

### Development-only QA mode

While `pnpm dev` is running, open `http://127.0.0.1:5173/?qa` to accelerate the simulation, force an early upgrade draft, and reach the boss window quickly. The gate uses Vite's development flag, so `?qa` has no effect in a production build or `pnpm preview`.

There are no energy gates, ads, loot boxes, or paid progression systems.
