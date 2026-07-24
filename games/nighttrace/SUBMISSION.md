# NIGHTTRACE mobile submission brief

## Shipping target

NIGHTTRACE v1.5.2 is an installable mobile web app suitable for HTTPS static
hosting and Add to Home Screen on current Android and iOS browsers. Menus remain
usable in portrait; combat is landscape-first and pauses behind an accessible
rotate gate when required. It supports safe-area insets, 44 px minimum touch
targets, direct arena touch steering, on-screen Pulse and pause controls,
offline campaign play, and deployment from a nested path.

## Store-wrapper handoff

The web build can be wrapped with Capacitor, Trusted Web Activity, or another
standards-based webview shell. A signed Android App Bundle or iOS archive still
requires publisher-owned choices and credentials:

- final application ID / bundle ID
- publisher and legal entity name
- Android keystore or Apple signing team and certificates
- store listing copy, screenshots, category, age rating, and support URL
- privacy declarations and final privacy-policy URL

The game has no account system, advertising SDK, analytics SDK, payment flow,
or remote backend. Campaign progress and settings are stored locally under
`nighttrace.save.v1`.

## Verified release matrix

- Browser sizes: 320x568, 390x844, constrained landscape-phone CSS viewport,
  844x390, and 1440x900
- Input: keyboard, pointer/touch drag, tappable Pulse, and pause; no D-pad
- Installability: web manifest, standard/maskable/Apple icons, production-only
  scoped service worker
- Offline: shell, generated chunks, all hero/enemy/boss/pickup atlases, and all
  arena backgrounds install-precache atomically
- Hosting: root and nested-path build contract
- Production hygiene: no source maps and no root-absolute app references
- Weapon VFX: all eight powers validated across Solo, Combined, Mastered, and
  Final states; non-concentric Halo/Bell Final states validated in landscape-phone view
- Public modes: Combat Lab validated with arbitrary arena/boss/loadout
  selection and infinite vitality; Boss Trials validated with sequential
  locks, curated builds, boss-only start gates, and isolated save progression
- Hostile presentation: restrained horde motion accents and ten
  sovereign-specific palettes/motifs, idle and locomotion signatures, normal
  melee choreography, and level-specific specials validated in live PixiJS combat

Physical-device smoke tests and store signing should be repeated after the
publisher identity and wrapper are finalized.
