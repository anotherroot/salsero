import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	RATE_LABEL,
	VIDEO_RATES,
	loadVideoPrefs,
	parseVideoPrefs,
	saveVideoPrefs
} from './video-prefs';

describe('parseVideoPrefs', () => {
	it('reads back what was saved', () => {
		expect(parseVideoPrefs('{"mirror":true,"rate":0.25,"hidden":true,"repeat":true}')).toEqual({
			mirror: true,
			rate: 0.25,
			hidden: true,
			repeat: true
		});
	});
	it('reads an older save without repeat as off', () => {
		expect(parseVideoPrefs('{"mirror":true,"rate":0.25}').repeat).toBe(false);
	});
	it('reads an older save without hidden as shown', () => {
		expect(parseVideoPrefs('{"mirror":true,"rate":0.25}').hidden).toBe(false);
	});
	it.each([null, '', 'junk', '{"mirror":"yes","rate":3,"hidden":"yes","repeat":1}'])(
		'falls back for %s',
		(raw) => {
			expect(parseVideoPrefs(raw)).toEqual({
				mirror: false,
				rate: 1,
				hidden: false,
				repeat: false
			});
		}
	);
});

describe('saveVideoPrefs', () => {
	afterEach(() => vi.unstubAllGlobals());

	function fakeStorage(initial: string | null) {
		const store = new Map<string, string>();
		if (initial !== null) store.set('video.prefs', initial);
		vi.stubGlobal('localStorage', {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => void store.set(k, v)
		});
	}

	it('merges what it is given over what is stored, so mirror never wipes Hide', () => {
		fakeStorage('{"mirror":false,"rate":1,"hidden":true}');
		saveVideoPrefs({ mirror: true });
		expect(loadVideoPrefs()).toEqual({ mirror: true, rate: 1, hidden: true, repeat: false });
	});
	it('saves Hide alone', () => {
		fakeStorage('{"mirror":true,"rate":0.5}');
		saveVideoPrefs({ hidden: true });
		expect(loadVideoPrefs()).toEqual({ mirror: true, rate: 0.5, hidden: true, repeat: false });
	});
});

describe('RATE_LABEL', () => {
	it('labels every rate', () => {
		expect(VIDEO_RATES.map((r) => RATE_LABEL[r])).toEqual(['¼×', '½×', '¾×', '1×']);
	});
});
