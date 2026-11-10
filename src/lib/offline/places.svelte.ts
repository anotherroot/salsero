/*
 * Where a person's own video is, live (offline phase 4c): the pure `placeOf`
 * fed by what the device says (its originals, its slot, the person's devices)
 * and the uploads in flight. Null while the phone's store has said nothing
 * (no store, or not ready): the video is drawn as before.
 */
import { browser } from '$app/environment';
import { kept } from './kept.svelte';
import { uploadOf } from './uploads.svelte';
import { isIphone } from './phone-first';
import { placeOf, type Place, type PlaceRow } from './where';

/** A video row as the Where button needs it. */
export type PhoneVideo = PlaceRow & { id: number; table: 'recordings' | 'lesson_videos' };

/** Originals the Android app holds in the gallery (offline phase 4c part 2); none until it says. */
export const appOriginals = $state<{ files: string[]; android: boolean }>({
	files: [],
	android: false
});

export function livePlace(row: PlaceRow | null | undefined): Place | null {
	const s = kept.status;
	if (!row || !s) return null;
	const mine = [...(s.originals ?? []), ...appOriginals.files];
	return placeOf(row, {
		held: (f) => mine.includes(f),
		slot: s.slot ?? null,
		uploading: uploadOf,
		devices: s.devices ?? {},
		iphone: browser && isIphone(navigator.userAgent, navigator.maxTouchPoints ?? 0),
		android: appOriginals.android
	});
}
