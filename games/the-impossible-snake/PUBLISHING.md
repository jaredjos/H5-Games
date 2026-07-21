# The Impossible Snake: Publishing Fork

This directory contains the publishing-ready source for The Impossible Snake. Generated builds and upload archives remain local and are excluded from Git.

## Platform Builds

The two portals require different SDKs and must receive separate archives:

```powershell
npm ci
npm run build:poki
npm run package:poki

npm run build:crazygames
npm run package:crazygames
```

Outputs:

- `releases/the-impossible-snake-poki.zip`
- `releases/the-impossible-snake-crazygames.zip`

For private portfolio or application review links, build the SDK-free standalone archive:

```powershell
npm run build:standalone
npm run package:standalone
```

This produces `releases/the-impossible-snake-standalone.zip`. Keep its hosting private or restricted while pursuing Poki's web-exclusive publishing path.

The Poki archive contains only the Poki SDK. The CrazyGames archive contains only the CrazyGames v3 SDK. All game art, fonts, JavaScript, and CSS are bundled locally.

## SDK Event Matrix

| Game transition | Platform event |
| --- | --- |
| Boot begins | CrazyGames `loadingStart()`; local loading event |
| Menu and playable assets ready | Poki `gameLoadingFinished()` / CrazyGames `loadingStop()` |
| First movement input | `gameplayStart()` and level `start` measure |
| Pause, life lost, level clear, game over, victory, or menu | `gameplayStop()` |
| Resume from pause | Poki/CrazyGames midgame break, then `gameplayStart()` |
| Retry or restart after a loss | CrazyGames midgame opportunity; Poki resumes without a commercial break |
| Out of lives | Optional rewarded revive offer |
| Reward accepted | Rewarded ad request; revive only after successful completion |
| Level clear | Level `complete` measure and CrazyGames completion percentage |
| Collision | Level `fail` measure |
| Final victory | Platform celebration event |

Consecutive gameplay start/stop calls are deduplicated. Input is blocked while an ad is requested, and audio is muted only after an ad actually starts. CrazyGames `muteAudio` settings override the in-game audio controls.

## Analytics

Poki and CrazyGames derive retention, session duration, gameplay time, and ad engagement from the SDK lifecycle and ad calls. Poki level funnels and rewarded-offer visibility/interactions are also measured.

A privacy-safe local diagnostic snapshot is stored under the `poki_ignore_` prefix and never sent to a third party. During local QA it can be inspected with:

```js
window.__IMPOSSIBLE_SNAKE_SDK__.events
window.__IMPOSSIBLE_SNAKE_SDK__.getEngagement()
```

## Poki Review Checklist

- Desktop, mobile, tablet, portrait, landscape, and safe-area layouts tested.
- Initial download is below the current 8 MB target.
- `index.html` is at the archive root and all build paths are relative.
- No third-party assets, fonts, analytics, ads, splash screens, or outgoing links.
- Local storage access is guarded for private/incognito browsing.
- Keyboard page scrolling, wheel scrolling, context menus, selection, and touch gestures are contained by the game.
- The game remains playable when an ad is unavailable or blocked.
- Rewarded revive is optional, clearly labeled, limited to once per run, and has an equally prominent restart alternative.
- The standard restart alternative is green and at least as prominent as the rewarded option.
- A text-free 1254 x 1254 static thumbnail is ready at `submission-assets/poki-thumbnail-1254.png`.
- Production builds exclude the level test console.
- Run the final archive through Poki Inspector before requesting review.

## Distribution Note

Poki currently asks for open-web exclusivity. Do not publish the CrazyGames archive if you accept a Poki exclusivity agreement. It is included as a separate technical target because the requested CrazyGames integration cannot coexist inside a Poki build.
