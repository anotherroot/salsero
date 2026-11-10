/** The iPhone card's state (offline phase 4c, look 3B), shared by every video on the page. */
import { browser } from '$app/environment';
import { iphoneWarning } from './iphone-warned';
import { isIphone } from './phone-first';

const warning = iphoneWarning(() => (browser ? localStorage : null));
export const iphoneCard = $state({ shown: browser && warning.shown() });

export function closeIphoneCard(): void {
	warning.close();
	iphoneCard.shown = false;
}

/** This page runs on an iPhone or an iPad (its stored files may be deleted). */
export function onIphone(): boolean {
	return browser && isIphone(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}
