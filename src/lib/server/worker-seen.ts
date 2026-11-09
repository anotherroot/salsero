/**
 * When the home worker last called (any `/api/worker/` request with its
 * token). In memory: after a restart it is unknown until the next call, which
 * comes within a minute or two when the worker runs. The AI is told the
 * worker is offline only when it has not called for 15 minutes.
 */
export const OFFLINE_AFTER_MS = 15 * 60_000;

const state = globalThis as { __salsaWorkerSeen?: number };

export function noteWorkerSeen(now: number): void {
	state.__salsaWorkerSeen = now;
}

export function workerStatus(now: number): 'online' | 'offline' | 'unknown' {
	const seen = state.__salsaWorkerSeen;
	if (seen === undefined) return 'unknown';
	return now - seen > OFFLINE_AFTER_MS ? 'offline' : 'online';
}

/** For specs. */
export function resetWorkerSeen(): void {
	delete state.__salsaWorkerSeen;
}
