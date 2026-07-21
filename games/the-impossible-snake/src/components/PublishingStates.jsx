import { LoaderCircle, RotateCcw } from "lucide-react";

export function LoadingScreen({ progress, error, onRetry }) {
  return (
    <main className="game-shell publishing-loading" aria-busy="true">
      <div className="loading-content" role="status" aria-live="polite">
        <span className="loading-mark" aria-hidden="true">IS</span>
        <h1>THE IMPOSSIBLE SNAKE</h1>
        <div
          className="loading-rail"
          role="progressbar"
          aria-label="Loading game"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={progress}
        >
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <p>{error ? "LOAD INTERRUPTED" : `INITIALIZING // ${String(progress).padStart(3, "0")}%`}</p>
        {error ? (
          <button type="button" className="loading-retry" onClick={onRetry} aria-label="Retry loading game">
            <RotateCcw />
            <span>RETRY</span>
          </button>
        ) : null}
      </div>
    </main>
  );
}

export function AdTransition({ playing }) {
  return (
    <div className="ad-transition" role="status" aria-live="assertive">
      <LoaderCircle aria-hidden="true" />
      <strong>{playing ? "AD BREAK" : "PREPARING AD"}</strong>
      <span>GAMEPLAY PAUSED</span>
    </div>
  );
}
