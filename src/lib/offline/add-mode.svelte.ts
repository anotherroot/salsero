/*
 * What adding a video does on this page (offline phase 4c), live: the pure
 * `addMode` fed by the app, the Android bridge, the screen and the store.
 */
import { browser } from '$app/environment';
import { kept } from './device.svelte';
import { addMode, type AddMode } from './add-phone';

/** The Android app keeps gallery originals (offline phase 4c part 2): its bridge is there. */
export function hasAppVideos(): boolean {
	return browser && 'SalsaVideos' in window;
}

export function currentAddMode(app: boolean, own: boolean): AddMode {
	return addMode(
		{
			app,
			appVideos: hasAppVideos(),
			coarse: browser && matchMedia('(pointer: coarse)').matches,
			store: kept.status !== null
		},
		own
	);
}
