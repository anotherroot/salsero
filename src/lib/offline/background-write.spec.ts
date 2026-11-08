import { afterEach, describe, expect, it, vi } from 'vitest';
import { backgroundWrite } from './background-write';
import { QUIET_HEADER } from './sw-route';

describe('backgroundWrite', () => {
	afterEach(() => vi.unstubAllGlobals());

	const stub = (onLine: boolean) => {
		const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
		vi.stubGlobal('fetch', fetch);
		vi.stubGlobal('navigator', { onLine });
		return fetch;
	};

	it('sends nothing offline: it could not land (the walk: opening a lesson offline)', () => {
		const fetch = stub(false);
		backgroundWrite('/api/opens', { method: 'POST', body: '{}' });
		expect(fetch).not.toHaveBeenCalled();
	});

	it('sends it online, marked quiet, keeping its own headers', () => {
		const fetch = stub(true);
		backgroundWrite('/api/opens', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{}',
			keepalive: true
		});
		expect(fetch).toHaveBeenCalledTimes(1);
		const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/opens');
		expect(init.keepalive).toBe(true);
		const h = new Headers(init.headers);
		expect(h.get(QUIET_HEADER)).toBe('1');
		expect(h.get('content-type')).toBe('application/json');
	});

	it('swallows a failure', async () => {
		const fetch = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
		vi.stubGlobal('fetch', fetch);
		vi.stubGlobal('navigator', { onLine: true });
		expect(() => backgroundWrite('/x', { method: 'POST' })).not.toThrow();
		await Promise.resolve();
	});
});
