import { byteSize } from './format';
import { t } from './i18n/catalog';

/**
 * Screening a multi-file selection, and saying afterwards what happened to it.
 * Client-safe and pure: the uploading itself lives in `ChunkedUploadButton`.
 *
 * Kept out of the component because a batch has an outcome a single upload does
 * not — some files land and others do not — and that outcome is worth testing
 * without a DOM.
 */

/** What `screenFiles` needs from a `File`, so a test can pass a plain object. */
export interface Screenable {
	name: string;
	size: number;
	type: string;
}

/** A file that will not be uploaded, and the phrase shown after its name. */
export interface Skipped {
	name: string;
	reason: string;
}

/**
 * Split a selection into what will be uploaded and what will not. A chunked
 * upload is always a lesson video, so the type check is for `video/`.
 *
 * Order is the
 * order the files were picked: videos have no position column, so the order
 * they are inserted in is the order they are read back in.
 */
export function screenFiles<T extends Screenable>(
	files: T[],
	maxBytes: number
): { accepted: T[]; rejected: Skipped[] } {
	const accepted: T[] = [];
	const rejected: Skipped[] = [];
	const why = t().refusals.files.reason;
	for (const file of files) {
		if (!/^video\//.test(file.type)) {
			rejected.push({ name: file.name, reason: why.notVideo });
		} else if (file.size > maxBytes) {
			rejected.push({
				name: file.name,
				reason: why.overLimit(byteSize(file.size), byteSize(maxBytes))
			});
		} else {
			accepted.push(file);
		}
	}
	return { accepted, rejected };
}

/**
 * The line shown once the batch is done, or `null` when there is nothing to
 * say. Success is silent — the videos appearing in the list is the message.
 */
export function summarise(added: number, rejected: Skipped[]): string | null {
	if (rejected.length === 0) return null;
	const w = t().refusals.files;
	const skipped = w.skipped(rejected.map((r) => `${r.name} (${r.reason})`).join(', '));
	if (added === 0) return skipped;
	return w.addedThenSkipped(added, skipped);
}

/** What the upload card shows while a video goes up. Pure: the component only draws it. */
export function uploadCard(s: {
	progress: number;
	position: { index: number; count: number } | null;
	retrying: boolean;
}): {
	title: string;
	helper: string;
	tone: 'accent' | 'warn';
	icon: 'upload' | 'refresh';
	percent: number;
} {
	const percent = Math.min(100, Math.max(0, Math.floor(s.progress * 100)));
	const w = t().refusals.files;
	if (s.retrying) {
		return {
			title: w.retrying,
			helper: w.retryingHelper(percent),
			tone: 'warn',
			icon: 'refresh',
			percent
		};
	}
	return {
		title: w.uploading(percent, s.position?.index ?? null, s.position?.count ?? null),
		helper: w.keepOpen,
		tone: 'accent',
		icon: 'upload',
		percent
	};
}

/** The title of the batch's outcome card, or `null` when nothing was skipped. */
export function summaryTitle(added: number, skipped: number): string | null {
	if (skipped === 0) return null;
	const w = t().refusals.files;
	if (added > 0) return w.someSkipped;
	return skipped === 1 ? w.oneNotAdded : w.noneAdded;
}
