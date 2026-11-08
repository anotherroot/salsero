import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The client sets its language once per page load (the root layout's
// `setClientLocale`). A sign-in applied by `use:enhance` is a client-side goto,
// which keeps the login page's language: on the Android app's first login that
// is English for a Slovenian account. So signing in, and joining, end in a full
// load, and the root layout reloads a page whose data names another language.

const read = (f: string) => readFileSync(f, 'utf8');
const FULL_LOAD = /if \(result\.type === 'redirect'\) return loadAgreed\(result\.location\);/;

describe('signing in ends in a full page load', () => {
	it.each(['src/routes/login/+page.svelte', 'src/routes/join/+page.svelte'])(
		'%s loads the redirect whole',
		(f) => {
			expect(read(f)).toMatch(FULL_LOAD);
		}
	);

	it('the root layout reloads a page drawn in another language than its data', () => {
		const src = read('src/routes/+layout.svelte');
		expect(src).toMatch(
			/needsLocaleReload\(\{ drawn: locale\(\), wanted, routeId, \.\.\.quietNow\(\) \}\)/
		);
		expect(src).toMatch(/updated: updated\.current \|\| localeStale\(locale\(\), data\.locale\)/);
	});
});
