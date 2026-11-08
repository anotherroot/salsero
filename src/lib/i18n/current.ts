// The current language, read the same way on either side. Client-safe: no node modules.
//
// In order: a `withLocale` override (synchronous, so it never outlives its call),
// the registered source (the server's per-request storage, `server/i18n-request.ts`),
// the browser's language (set once by the root layout), then English. The server
// never keeps the language in a module variable: `setClientLocale` does nothing there.
import { browser } from '$app/environment';
import type { Locale } from './locale';

let override: Locale | undefined;
let source: (() => Locale | undefined) | undefined;
let client: Locale | undefined;

export function locale(): Locale {
	return override ?? source?.() ?? client ?? 'en';
}

/** The server registers its per-request reader here. */
export function setLocaleSource(fn: () => Locale | undefined): void {
	source = fn;
}

/** The browser's language, from the page data. Does nothing on the server. */
export function setClientLocale(l: Locale): void {
	if (!browser) return;
	client = l;
}

/** Runs `fn` in `l`: for specs, and for words drawn in someone else's language. Synchronous only. */
export function withLocale<T>(l: Locale, fn: () => T): T {
	const before = override;
	override = l;
	try {
		return fn();
	} finally {
		override = before;
	}
}
