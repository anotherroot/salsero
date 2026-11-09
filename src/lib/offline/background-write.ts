/*
 * A write the person did not ask for (offline phase 2): an open that clears
 * "new", a practice remembered for next time. Fire and forget: a failure
 * changes nothing the person sees. Client-safe.
 */
import { QUIET_HEADER } from './sw-route';

/**
 * Sends it, unless the browser is offline: it could not land, and the failed
 * request would only fill the console. Marked quiet, so when the network fails
 * anyway the service worker answers it without the "Needs a connection" toast.
 * The promise settles when the request has (never rejecting), for a caller
 * that must know it landed before it reads the page again.
 */
export function backgroundWrite(url: string, init: RequestInit): Promise<void> {
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve();
	const headers = new Headers(init.headers);
	headers.set(QUIET_HEADER, '1');
	return fetch(url, { ...init, headers }).then(
		() => {},
		() => {}
	);
}
