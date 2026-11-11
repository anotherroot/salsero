/*
 * Move to a group with videos only on a phone (offline phase 4c): a moved
 * lesson is archived, so those this phone holds upload first; those on
 * another device (or gone from this one) can only stay behind. PURE.
 */
import type { DeviceLabel } from '$lib/devices/label';
import type { Place } from './where';

export type MoveVideos<T> = {
	/** This phone holds the original and it is not up yet: Upload and move. */
	here: T[];
	/** Not uploadable from here: on another device, gone from this one, or not known. */
	elsewhere: T[];
	/** The device the first of `elsewhere` is on, when known. */
	label: DeviceLabel | null;
};

export function splitMoveVideos<T>(rows: T[], placeOf: (row: T) => Place | null): MoveVideos<T> {
	const out: MoveVideos<T> = { here: [], elsewhere: [], label: null };
	for (const row of rows) {
		const p = placeOf(row);
		// Uploaded since the page loaded: it moves with the lesson.
		if (p?.state === 'both' || p?.state === 'server') continue;
		if (p?.state === 'only' || p?.state === 'uploading') out.here.push(row);
		else {
			if (out.elsewhere.length === 0 && p?.state === 'elsewhere') out.label = p.label;
			out.elsewhere.push(row);
		}
	}
	return out;
}
