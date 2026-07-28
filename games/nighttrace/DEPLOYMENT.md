# Nighttrace deployment

The production build is published to the repository's `gh-pages` branch by
`.github/workflows/deploy-nighttrace.yml`.

Every change under `games/nighttrace/` rebuilds the game with the locked
pnpm dependencies, replaces only the hosted `nighttrace/` directory, preserves
the repository's other H5 games, and reads the release number from
`package.json` for its deployment commit. The workflow can also be started
manually from GitHub Actions when a clean republish is needed.
