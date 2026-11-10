/** PURE: the wording and the bar of the storage lines. Client-safe. */
import { byteSize, dateLabel } from './format';
import { t } from './i18n/catalog';

/** "Using 820 MB of 1.0 GB", or "Using 820 MB" with no limit. */
export function usageLine(used: number, limit: number | null): string {
	const w = t().settings.storage;
	return limit === null ? w.using(byteSize(used)) : w.usingOf(byteSize(used), byteSize(limit));
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
	return t().settings.storage.asked(dateLabel(day));
}

/** How much the songs and the count takes take on this phone (offline phase 4a). */
export function songsOnPhoneLine(bytes: number): string {
	return t().settings.onPhone.songs(byteSize(bytes));
}
