# H5 Games

A collection of polished HTML5 browser games, organized as independent projects with reproducible local and platform-specific builds.

## Games

| Game | Description | Stack | Status |
| --- | --- | --- | --- |
| [The Impossible Snake](games/the-impossible-snake) | A cinematic 3D snake survival game with ten levels, hunters, obstacles, lives, boosters, adaptive audio, and desktop/mobile controls. | React, Three.js, React Three Fiber, Vite | [Play over HTTPS](https://jaredjos.github.io/H5-Games/the-impossible-snake/) |
| [NIGHTTRACE](games/nighttrace) | A landscape-first horde-survival action game with ten animated boss patterns, timed support relics, auto-attacking weapons, Trace circuits, awakenings, and persistent progression. | React, TypeScript, PixiJS, Vite | [Play over HTTPS](https://jaredjos.github.io/H5-Games/nighttrace/) |

## Repository Layout

```text
games/
  nighttrace/
  the-impossible-snake/
```

Each game owns its source, assets, dependency lockfile, submission metadata, and packaging scripts. Generated folders and upload archives are intentionally excluded from Git.

## Run A Game

```powershell
cd games/nighttrace
pnpm install --frozen-lockfile
pnpm dev
```

## Production Build

```powershell
cd games/nighttrace
pnpm build
```

Each game documents any additional launchers or platform-specific packaging in
its own README.
