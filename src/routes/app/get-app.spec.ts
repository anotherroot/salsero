import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Release } from '$lib/app-update/agent';

const releases = vi.hoisted(() => ({
	current: vi.fn<(dance: string) => Release | null>()
}));
vi.mock('$lib/server/releases', () => ({ currentRelease: releases.current }));

import { inviteQr } from '$lib/server/invites';
import { load } from './+page.server';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari';
const ANDROID =
	'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36';

const rel = (versionCode: number): Release => ({
	versionCode,
	versionName: '1.1',
	minVersionCode: 1,
	sha256: 'x',
	size: 5 * 1024 * 1024,
	commit: 'abc'
});

type Data = {
	device: string;
	qr: ReturnType<typeof inviteQr> | null;
	cards: { dance: string; download: { url: string } | null }[];
};
const run = (ua: string, origin = 'https://salsa.example', dance = 'salsa') =>
	(load as (e: unknown) => Promise<Data>)({
		request: new Request(`${origin}/app`, { headers: { 'user-agent': ua } }),
		url: new URL(`${origin}/app`),
		parent: async () => ({ appDance: dance })
	});

beforeEach(() => {
	releases.current.mockReset();
	releases.current.mockImplementation((d) => (d === 'salsa' ? rel(7) : null));
});

describe('/app load', () => {
	it('an iPhone gets the device and cards, no QR', async () => {
		const d = await run(IPHONE);
		expect(d.device).toBe('ios');
		expect(d.cards.map((c) => c.dance)).toEqual(['salsa']);
		expect(d.cards.every((c) => c.download === null)).toBe(true);
		expect(d.qr).toBeNull();
	});
	// Catches: a dance's host offering the other dance's app (the dance split).
	it("Android gets its dance's app only, a download when released, and no QR", async () => {
		const d = await run(ANDROID);
		expect(d.device).toBe('android');
		expect(d.qr).toBeNull();
		expect(d.cards).toHaveLength(1);
		expect(d.cards[0].download?.url).toBe('/releases/salsa/7.apk');
		const b = await run(ANDROID, 'https://bachata.example', 'bachata');
		expect(b.cards.map((c) => [c.dance, c.download])).toEqual([['bachata', null]]);
	});
	it('a desktop also gets a QR of the page itself', async () => {
		const d = await run(DESKTOP);
		expect(d.device).toBe('other');
		expect(d.qr).toEqual(inviteQr('https://salsa.example/app'));
	});
	it('the QR follows the request origin', async () => {
		const d = await run(DESKTOP, 'http://localhost:5173');
		expect(d.qr).toEqual(inviteQr('http://localhost:5173/app'));
		expect(d.qr).not.toEqual(inviteQr('https://salsa.example/app'));
	});
});
