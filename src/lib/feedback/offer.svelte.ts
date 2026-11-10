/**
 * The Android app's screenshots, offered for a report. The app (Android 14 and
 * later) notices a screenshot and posts this page a JPEG of it on `SalsaShot`
 * once the page has asked with `listen`; the "Something wrong here?" card
 * (`ShotOffer.svelte`) shows it. In a browser there is no `SalsaShot` and
 * nothing happens.
 */
import { isShot } from './shot';

interface Bridge {
	postMessage(message: string): void;
	onmessage: ((event: { data: unknown }) => void) | null;
}

/** The last screenshot offered; `seq` grows with each, so the card starts its time again. */
export const offer = $state<{ shot: string | null; seq: number }>({ shot: null, seq: 0 });

/** Ask the app for screenshots; returns the undo. */
export function listenForShots(): () => void {
	const bridge = (window as unknown as { SalsaShot?: Bridge }).SalsaShot;
	if (!bridge) return () => {};
	const handler = (event: { data: unknown }) => {
		if (!isShot(event.data)) return;
		offer.shot = event.data;
		offer.seq += 1;
	};
	bridge.onmessage = handler;
	bridge.postMessage('listen');
	return () => {
		if (bridge.onmessage === handler) bridge.onmessage = null;
	};
}
