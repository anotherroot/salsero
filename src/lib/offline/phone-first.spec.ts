import { describe, expect, it } from 'vitest';
import { isIphone, phoneFirst } from './phone-first';

describe('phoneFirst: a new own video stays on this phone (offline phase 4c)', () => {
	it('the new Android app (SalsaVideos)', () => {
		expect(phoneFirst({ app: true, appVideos: true, coarse: true, store: true })).toBe(true);
	});

	it('an old Android app: no, it uploads at once', () => {
		expect(phoneFirst({ app: true, appVideos: false, coarse: true, store: true })).toBe(false);
	});

	it('an iPhone web app, a phone browser, with the store', () => {
		expect(phoneFirst({ app: false, appVideos: false, coarse: true, store: true })).toBe(true);
	});

	it('a computer (fine pointer), or no store: no', () => {
		expect(phoneFirst({ app: false, appVideos: false, coarse: false, store: true })).toBe(false);
		expect(phoneFirst({ app: false, appVideos: false, coarse: true, store: false })).toBe(false);
	});
});

describe('isIphone', () => {
	it('iPhone, iPad, and an iPad that calls itself a Mac (touch)', () => {
		expect(isIphone('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)', 0)).toBe(true);
		expect(isIphone('Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)', 0)).toBe(true);
		expect(isIphone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', 5)).toBe(true);
		expect(isIphone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', 0)).toBe(false);
		expect(isIphone('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5)).toBe(false);
	});
});
