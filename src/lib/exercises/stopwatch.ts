/**
 * Wall-clock time spent practising, pauses left out. PURE: `now` is always an
 * argument, so the panel can test nothing and this file can test everything.
 *
 * Wall clock, not song time, on purpose: the full player logs SONG seconds, so
 * a run at 0.7× under-reports the time actually spent (a known gap in the main
 * design). The panel's minutes are the minutes you stood there dancing.
 */
export interface Stopwatch {
	/** Time already banked by earlier runs. */
	bankedMs: number;
	/** When the current run started, or null while paused or stopped. */
	runningSince: number | null;
}

export const STOPPED: Stopwatch = { bankedMs: 0, runningSince: null };

export function startWatch(w: Stopwatch, now: number): Stopwatch {
	return w.runningSince !== null ? w : { ...w, runningSince: now };
}

export function pauseWatch(w: Stopwatch, now: number): Stopwatch {
	return w.runningSince === null ? w : { bankedMs: elapsedMs(w, now), runningSince: null };
}

export function elapsedMs(w: Stopwatch, now: number): number {
	return w.bankedMs + (w.runningSince === null ? 0 : Math.max(0, now - w.runningSince));
}
