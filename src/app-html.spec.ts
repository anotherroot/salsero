import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_HEADER } from '$lib/app-update/agent';

/*
 * app.html's fetch wrapper, run as the browser would. Inside the Android app
 * the page's own user agent carries `SalsaApp/…`, but a request the service
 * worker sends on carries the worker's, which never does: the page says which
 * app it is in a header of its own.
 */
describe('app.html tells the server which app it is', () => {
	const app = readFileSync('src/app.html', 'utf8');
	const script = /<script>([\s\S]*?)<\/script>/.exec(app)?.[1] ?? '';

	async function sent(userAgent: string, url: string) {
		const calls: Headers[] = [];
		const window = {
			fetch: (_input: unknown, init?: RequestInit) => {
				calls.push(new Headers(init?.headers));
				return Promise.resolve(new Response('ok'));
			}
		} as Record<string, unknown> & { fetch: typeof fetch };
		const root = {
			dataset: { themeChoice: 'light', pageEpoch: '13' } as Record<string, string>,
			style: { setProperty() {} }
		};
		const document = { documentElement: root, cookie: '' };
		const matchMedia = () => ({ matches: false, addEventListener() {} });
		const location = new URL('https://salsa.example/salsa');
		const navigator = { userAgent };
		new Function('window', 'document', 'matchMedia', 'location', 'navigator', script)(
			window,
			document,
			matchMedia,
			location,
			navigator
		);
		await window.fetch(url);
		return calls[0];
	}

	const APP_UA =
		'Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 SalsaApp/11 (salsa; direct)';

	it('sends the app’s part of the user agent on the site’s own requests', async () => {
		const h = await sent(APP_UA, '/salsa/__data.json');
		expect(h.get(APP_HEADER)).toBe('SalsaApp/11 (salsa; direct)');
		expect(h.get('x-page-epoch')).toBe('13');
	});

	it('sends nothing outside the app, nor to another site', async () => {
		expect((await sent('Mozilla/5.0 Chrome/130.0', '/salsa')).has(APP_HEADER)).toBe(false);
		expect((await sent(APP_UA, 'https://other.example/x')).has(APP_HEADER)).toBe(false);
	});
});
