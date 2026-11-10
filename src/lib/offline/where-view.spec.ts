import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { placeWord, uploadNote } from './where-view';

describe("placeWord: the words after a video's name (offline phase 4c)", () => {
	it('for each place', () => {
		withLocale('en', () => {
			expect(placeWord({ state: 'server' })).toBeNull();
			expect(placeWord({ state: 'only', iphone: false })).toEqual({
				text: 'only on this phone',
				tone: 'ink'
			});
			expect(placeWord({ state: 'only', iphone: true })).toEqual({
				text: 'only on this iPhone',
				tone: 'warn'
			});
			expect(placeWord({ state: 'uploading', pct: 40 })).toEqual({
				text: 'uploading 40%',
				tone: 'muted'
			});
			expect(placeWord({ state: 'both', copyBytes: 5 })).toEqual({
				text: 'on this phone and the server',
				tone: 'done'
			});
			expect(
				placeWord({ state: 'elsewhere', label: { kind: 'android', model: 'Pixel 8' } })
			).toEqual({ text: 'on Pixel 8', tone: 'ink' });
			expect(placeWord({ state: 'missing', gallery: true })).toEqual({
				text: 'no longer in the gallery',
				tone: 'danger'
			});
		});
		withLocale('sl', () => {
			expect(placeWord({ state: 'elsewhere', label: { kind: 'iphone', model: null } })?.text).toBe(
				'na iPhonu'
			);
		});
	});
});

describe('uploadNote: what Upload sends, said under the sheet', () => {
	it('the app compresses; a browser (an iPhone, an Android browser) sends the original', () => {
		withLocale('en', () => {
			expect(uploadNote(true)).toContain('smaller copy');
			expect(uploadNote(false)).toContain('the original');
			expect(uploadNote(false)).not.toContain('iPhone');
		});
	});
});
