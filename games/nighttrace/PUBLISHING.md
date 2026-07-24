# NIGHTTRACE publishing

## Release identity

- Repository path: `games/nighttrace`
- H5 runtime: React + TypeScript + PixiJS + Vite
- Current web release: `v1.4.0`
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

The release is acceptable only when all seven test files and all 66 unit tests
pass, lint exits cleanly, the subpath verifier passes, no production source
maps are emitted, and Vite produces `dist/index.html`.

The v1.4.0 weapon-visual gate additionally requires 32 deterministic runtime
captures (eight weapons across Solo, Combined, Mastered, and Final), updated
capture hashes, and landscape-phone checks with no document overflow or browser
errors.

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

Release archives and executable launchers are generated artifacts and are
excluded from source control.
