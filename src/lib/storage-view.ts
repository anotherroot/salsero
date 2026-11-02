/** PURE: the wording and the bar of the storage lines. Client-safe. */
import { byteSize, dateLabel } from './format';

/** "Using 820 MB of 1.0 GB", or "Using 820 MB" with no limit. */
export function usageLine(used: number, limit: number | null): string {
	return limit === null
		? `Using ${byteSize(used)}`
		: `Using ${byteSize(used)} of ${byteSize(limit)}`;
}

/** How much of the bar is filled, 0 to 1. No limit draws no bar. */
export function barFraction(used: number, limit: number | null): number {
	if (limit === null) return 0;
	if (limit <= 0) return 1;
	return Math.min(1, Math.max(0, used / limit));
}

/** A row's second line: what it belongs to, then its size. */
export function itemMeta(item: { context: string; sizeBytes: number }): string {
	return `${item.context} · ${byteSize(item.sizeBytes)}`;
}

/** The Ask for more row while a request waits (`day` is a calendar day in the person's zone). */
export function askedLine(day: string): string {
	return `Asked on ${dateLabel(day)} · waiting`;
}
