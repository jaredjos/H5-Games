# H5 Games

A collection of polished HTML5 browser games, organized as independent projects with reproducible local and platform-specific builds.

## Games

| Game | Description | Stack | Status |
| --- | --- | --- | --- |
| [The Impossible Snake](games/the-impossible-snake) | A cinematic 3D snake survival game with ten levels, hunters, obstacles, lives, boosters, adaptive audio, and desktop/mobile controls. | React, Three.js, React Three Fiber, Vite | Publishing candidate |

## Repository Layout

```text
games/
  the-impossible-snake/
```

Each game owns its source, assets, dependency lockfile, submission metadata, and packaging scripts. Generated folders and upload archives are intentionally excluded from Git.

## Run A Game

```powershell
cd games/the-impossible-snake
npm ci
npm run dev
```

## Build Targets

```powershell
npm run build:standalone
npm run build:poki
npm run build:crazygames
```

Poki and CrazyGames builds contain different SDK integrations and must be uploaded only to their matching platform.

