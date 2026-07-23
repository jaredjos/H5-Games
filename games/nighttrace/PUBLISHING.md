# NIGHTTRACE publishing

## Release identity

- Repository path: `games/nighttrace`
- H5 runtime: React + TypeScript + PixiJS + Vite
- Current desktop release tag: `nighttrace-v1.0.0`
- Save key: `nighttrace.save.v1`

## Validation gate

Run the following from this directory before packaging:

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm build
```

The release is acceptable only when all four test files and all 37 unit tests
pass, lint exits cleanly, and Vite produces `dist/index.html`.

## Standalone archive

The Windows archive contains:

```text
NIGHTTRACE Launcher.exe
PLAY NIGHTTRACE.cmd
README.md
dist/
```

Keep the launcher beside `dist/`. The launcher serves the static build on
loopback and opens the default browser. Mobile distribution uses an HTTPS host
instead of the Windows launcher.

## Versioning

- `nighttrace-v1.0.0`: frozen desktop-first build.
- `nighttrace-v1.1.0-mobile`: mobile/PWA hardening release.

Release archives are generated artifacts and are excluded from source control.
