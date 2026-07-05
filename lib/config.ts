// Kiosk timing knobs — all durations in one place.

export const COUNTDOWN_SECONDS = 5;

// The burst always captures this many photos, regardless of package.
export const BURST_COUNT = 6;

// Pause between a capture and the next countdown, so the flash + thumbnail
// registers before the timer restarts.
export const INTER_SHOT_MS = 1400;

// DoneView is shown for exactly this long, uninterruptible, then the whole
// session resets to the attract screen.
export const DONE_SECONDS = 5;
