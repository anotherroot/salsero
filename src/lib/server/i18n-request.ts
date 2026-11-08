// The server's current language: per request, in AsyncLocalStorage, never a
// module variable. `hooks.server.ts` wraps `resolve` in `runInLocale`.
import { AsyncLocalStorage } from 'node:async_hooks';
import { setLocaleSource } from '$lib/i18n/current';
import type { Locale } from '$lib/i18n/locale';

const store = new AsyncLocalStorage<Locale>();

setLocaleSource(() => store.getStore());

export function runInLocale<T>(l: Locale, fn: () => T): T {
	return store.run(l, fn);
}
