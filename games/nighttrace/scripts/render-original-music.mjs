// Kept as the package-script entrypoint so older build instructions cannot
// accidentally restore Nighttrace's retired procedural score. The importer
// reads the approved source paths from command-line flags or FFMPEG_PATH; it
// never assumes a developer-specific Downloads directory.
await import('./import-third-party-audio.mjs')
