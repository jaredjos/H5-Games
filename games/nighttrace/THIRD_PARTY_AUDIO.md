# Nighttrace third-party audio

Nighttrace integrates the following music as part of its interactive soundtrack.
The runtime files are mastered derivatives: terminal silence is removed, the
tail and head are joined through an equal-power circular seam, and the result is
normalized to approximately -14 LUFS integrated with a -1.5 dBTP ceiling.

This record identifies the supplied source files and their provenance. It is
not a representation that every possible distribution, storefront, broadcast,
stream, or monetization use has received separate legal clearance.

## Source record

Downloaded on 2026-07-28.

### Haunted House Explorer - Instrumental

- Creator: UniqueCreativeAudio
- Source platform: Pixabay
- Source page:
  <https://pixabay.com/music/mystery-haunted-house-explorer-instrumental-168968/>
- Supplied filename:
  `uniquecreativeaudio-haunted-house-explorer-instrumental-168968.mp3`
- SHA-256:
  `541925E9A4C6AFC84C76C24172066F5BDDB94B10D15304194FDF1D519F79266E`
- Runtime use: ambient score for sectors 1, 2, 4, 5, 7, 9, and 10.
- Source page designation at download: free for use under the Pixabay Content
  License.

### Creepy Retro Gaming Music (No Copyright)

- Creator: BouncyRunner
- Source platform: Pixabay
- Source page:
  <https://pixabay.com/music/video-games-creepy-retro-gaming-music-no-copyright-401536/>
- Supplied filename:
  `bouncyrunner-creepy-retro-gaming-music-no-copyright-401536.mp3`
- SHA-256:
  `0E1A74CFA79823F811F49A8872627AB898697E3A77BA54281C29CE31C33331B1`
- Runtime use: ambient score for sectors 3, 6, and 8.
- Source page designation at download: AI-generated and free for use under the
  Pixabay Content License.

### Drift Phonk Music (Phonk Mix)

- Creator: Tunetank
- Source platform: Pixabay
- Source page:
  <https://pixabay.com/music/video-games-drift-phonk-music-phonk-mix-349313/>
- Supplied filename:
  `tunetank-drift-phonk-music-phonk-mix-349313.mp3`
- SHA-256:
  `F41D3E5998B51BE53457D2485F5BF09897D3AA5BBEE91BFB7907DD9913EACC28`
- Runtime use: every boss encounter.
- Source page designation at download: free for use under the Pixabay Content
  License and registered with Content ID.

#### Tunetank licensing and Content ID warning

The Pixabay asset page presents this download under the Pixabay Content
License. Tunetank's separately published license page currently lists video
games among prohibited uses:
<https://tunetank.com/legal/license/>.

Those two statements are not treated here as equivalent or reconciled legal
clearance. Preserve the original Pixabay download record and dated license-page
evidence. Before a commercial storefront release, obtain explicit game-use
confirmation from the relevant rights holder or replace the track. Because the
asset is registered with Content ID, videos and livestreams containing the boss
music may also receive automated claims even when the in-game use relies on a
valid license.

## Runtime derivatives

The import produces only the selected sector track and boss track at runtime:

- `public/assets/audio/nighttrace-haunted-loop.mp3`
- `public/assets/audio/nighttrace-haunted-loop-compact.mp3`
- `public/assets/audio/nighttrace-retro-loop.mp3`
- `public/assets/audio/nighttrace-retro-loop-compact.mp3`
- `public/assets/audio/nighttrace-phonk-loop.mp3`
- `public/assets/audio/nighttrace-phonk-loop-compact.mp3`

Full variants use 192 kbps MP3. Compact variants use 96 kbps MP3 and are
selected only for Save-Data clients or devices reporting at most 2 GB of
memory. Music assets are requested on demand rather than added to the
service-worker installation shell.

## Repeatable import

Use an FFmpeg build with `libmp3lame`, `acrossfade`, and `loudnorm`:

```powershell
node scripts/import-third-party-audio.mjs `
  --haunted "PATH\TO\uniquecreativeaudio-haunted-house-explorer-instrumental-168968.mp3" `
  --retro "PATH\TO\bouncyrunner-creepy-retro-gaming-music-no-copyright-401536.mp3" `
  --phonk "PATH\TO\tunetank-drift-phonk-music-phonk-mix-349313.mp3" `
  --ffmpeg "PATH\TO\ffmpeg.exe"
```

The importer verifies all three source hashes, renders a circular equal-power
loop, performs two-pass EBU R128 normalization, analyzes each delivered MP3,
and fails if integrated loudness or true peak falls outside the accepted
delivery tolerance.
