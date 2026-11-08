import { afterEach, describe, expect, it, vi } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import {
	rateLabel,
	VIDEO_RATES,
	loadVideoPrefs,
	parseVideoPrefs,
	saveVideoPrefs
} from './video-prefs';

describe('parseVideoPrefs', () => {
	it('reads back what was saved', () => {
		expect(
			parseVideoPrefs('{"mirror":true,"rate":0.25,"hidden":true,"muted":true,"repeat":true}')
		).toEqual({
			mirror: true,
			rate: 0.25,
			hidden: true,
			muted: true,
			repeat: true
		});
	});
	it('reads an older save without muted as sound on', () => {
		expect(parseVideoPrefs('{"mirror":true,"rate":0.25}').muted).toBe(false);
	});
	it('reads an older save without repeat as off', () => {
		expect(parseVideoPrefs('{"mirror":true,"rate":0.25}').repeat).toBe(false);
	});
	it('reads an older save without hidden as shown', () => {
		expect(parseVideoPrefs('{"mirror":true,"rate":0.25}').hidden).toBe(false);
	});
	it.each([null, '', 'junk', '{"mirror":"yes","rate":3,"hidden":"yes","muted":1,"repeat":1}'])(
		'falls back for %s',
		(raw) => {
			expect(parseVideoPrefs(raw)).toEqual({
				mirror: false,
				rate: 1,
				hidden: false,
				muted: false,
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
		expect(loadVideoPrefs()).toEqual({
			mirror: true,
			rate: 1,
			hidden: true,
			muted: false,
			repeat: false
		});
	});
	it('saves Hide alone', () => {
		fakeStorage('{"mirror":true,"rate":0.5}');
		saveVideoPrefs({ hidden: true });
		expect(loadVideoPrefs()).toEqual({
			mirror: true,
			rate: 0.5,
			hidden: true,
			muted: false,
			repeat: false
		});
	});
	it('saves mute alone, keeping the rest', () => {
		fakeStorage('{"mirror":true,"rate":0.5,"hidden":true,"repeat":true}');
		saveVideoPrefs({ muted: true });
		expect(loadVideoPrefs()).toEqual({
			mirror: true,
			rate: 0.5,
			hidden: true,
			muted: true,
			repeat: true
		});
	});
	it('saves repeat alone, keeping the rest', () => {
		fakeStorage('{"mirror":true,"rate":0.5,"hidden":true,"muted":true}');
		saveVideoPrefs({ repeat: true });
		expect(loadVideoPrefs()).toEqual({
			mirror: true,
			rate: 0.5,
			hidden: true,
			muted: true,
			repeat: true
		});
	});
});

describe('rateLabel', () => {
	it('labels every rate', () => {
		expect(VIDEO_RATES.map((r) => rateLabel(r))).toEqual(['¼×', '½×', '¾×', '1×']);
	});
});

describe('rateLabel in Slovenian', () => {
	it('labels every rate with a decimal comma', () => {
		expect(withLocale('sl', () => VIDEO_RATES.map((r) => rateLabel(r)))).toEqual([
			'0,25×',
			'0,5×',
			'0,75×',
			'1×'
		]);
	});
});
