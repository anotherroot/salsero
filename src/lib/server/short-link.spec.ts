import { describe, expect, it, vi } from 'vitest';
import { resolveShortLink } from './short-link';

const SHORT = 'https://spotify.link/AbCdE';

function answering(res: Response | Error) {
	return vi.fn(async () => {
		if (res instanceof Error) throw res;
		return res;
	}) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('resolveShortLink', () => {
	it('follows one redirect to open.spotify.com, headers only', async () => {
		const to = 'https://open.spotify.com/track/X?si=1';
		const f = answering(new Response(null, { status: 301, headers: { location: to } }));
		expect(await resolveShortLink(SHORT, f)).toBe(to);
		const [url, init] = f.mock.calls[0] as [string, RequestInit];
		expect(url).toBe(SHORT);
		expect(init).toMatchObject({ method: 'HEAD', redirect: 'manual' });
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it('gives null for no redirect, a failure, or somewhere else', async () => {
		expect(
			await resolveShortLink(SHORT, answering(new Response(null, { status: 200 })))
		).toBeNull();
		expect(await resolveShortLink(SHORT, answering(new Error('offline')))).toBeNull();
		const away = new Response(null, {
			status: 302,
			headers: { location: 'https://evil.example/x' }
		});
		expect(await resolveShortLink(SHORT, answering(away))).toBeNull();
	});
});
