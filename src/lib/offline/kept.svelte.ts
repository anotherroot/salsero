/*
 * Videos kept on the phone, for the page (offline phase 4b): the worker's
 * status (`kept`, kept current by `device.svelte.ts`) and the one way to
 * change it. Turning anything on asks the browser once to keep this app's
 * storage (`persist()`), so it does not clear kept videos when space runs low.
 */
import type { KeepChange } from './protocol';
import { kept, keepSet } from './device.svelte';

export { kept };

let persistAsked = false;

export async function changeKeep(change: KeepChange): Promise<void> {
	if ('on' in change && change.on && !persistAsked) {
		persistAsked = true;
		try {
			void navigator.storage?.persist?.().catch(() => {});
		} catch {
			// Not in this browser: kept videos may then be cleared by it under pressure.
		}
	}
	await keepSet(change);
}
