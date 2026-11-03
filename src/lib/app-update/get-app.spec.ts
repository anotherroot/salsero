import { describe, expect, it } from 'vitest';
import type { Release } from './agent';
import { getAppCards, joinLanding } from './get-app';

const rel = (versionCode: number, size = 12 * 1024 * 1024): Release => ({
	versionCode,
	versionName: '1.1',
	minVersionCode: 1,
	sha256: 'x',
	size,
	commit: 'abc'
});

describe('getAppCards', () => {
	it('Android with both released: two cards with a download', () => {
		const cards = getAppCards('android', { salsa: rel(2), bachata: rel(3) });
		expect(cards.map((c) => c.dance)).toEqual(['salsa', 'bachata']);
		expect(cards.map((c) => c.label)).toEqual(['Salsa', 'Bachata']);
		expect(cards[0].download).toEqual({ url: '/releases/salsa/2.apk', size: '12 MB' });
		expect(cards[1].download?.url).toBe('/releases/bachata/3.apk');
		expect(cards.map((c) => c.open)).toEqual(['/salsa', '/bachata']);
	});
	it('Android with bachata missing: no download for it', () => {
		const cards = getAppCards('android', { salsa: rel(2), bachata: null });
		expect(cards[0].download).not.toBeNull();
		expect(cards[1].download).toBeNull();
	});
	it('iOS and other: no downloads', () => {
		for (const d of ['ios', 'other'] as const) {
			const cards = getAppCards(d, { salsa: rel(2), bachata: rel(2) });
			expect(cards.every((c) => c.download === null)).toBe(true);
		}
	});
});

describe('joinLanding', () => {
	it('stays in the app, offers the app in a browser', () => {
		expect(joinLanding(true)).toBe('/');
		expect(joinLanding(false)).toBe('/app');
	});
});
