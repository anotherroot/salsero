/*
 * The worker's own view of what is kept (offline phase 4b): PURE, no words, so
 * the device worker can bundle it (`kept-view.ts` has the page's words).
 */
import type { KeepStatus } from './protocol';

/**
 * The status after a video landed, before the pass ends: held at once, so a
 * space's count and bytes go up file by file instead of jumping at the end.
 * The worker then redraws the spaces' rows from it (`keepRows`).
 */
export function withStored(status: KeepStatus, key: string, size: number): KeepStatus {
	const partial = { ...status.partial };
	delete partial[key];
	const fresh = !status.held.includes(key);
	return {
		...status,
		held: fresh ? [...status.held, key] : status.held,
		partial,
		inFlight: status.inFlight?.key === key ? null : status.inFlight,
		bytes: { ...status.bytes, videos: status.bytes.videos + (fresh ? size : 0) }
	};
}
