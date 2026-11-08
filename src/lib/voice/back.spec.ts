import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { myCountHref, voiceBack } from './back';

describe('voiceBack', () => {
	it('goes back to Settings without a from', () => {
		expect(voiceBack(null)).toEqual({ href: '/settings', label: 'Back to Settings' });
	});

	it('goes back to Practice, query and all, when opened from it', () => {
		expect(voiceBack('/salsa/player?song=3')).toEqual({
			href: '/salsa/player?song=3',
			label: 'Back to Practice'
		});
		expect(voiceBack('/bachata/player')).toEqual({
			href: '/bachata/player',
			label: 'Back to Practice'
		});
	});

	it('goes back to You when opened from it: the Groups list or the You page', () => {
		expect(voiceBack('/salsa/groups')).toEqual({ href: '/salsa/groups', label: 'Back to You' });
		expect(voiceBack('/bachata/you')).toEqual({ href: '/bachata/you', label: 'Back to You' });
		for (const bad of [
			'/salsa/groups/3',
			'/salsa/you?x=1',
			'//evil.example/salsa/you',
			'/tango/you'
		])
			expect(voiceBack(bad).href).toBe('/settings');
	});

	it('is no open redirect: anything else is Settings', () => {
		for (const bad of [
			'https://evil.example/salsa/player',
			'//evil.example/salsa/player',
			'/salsa/figures',
			'/salsa/playerx',
			'%zz',
			'',
			'/salsa/player?x=//evil.example',
			'/salsa/player?x=\\evil',
			'/tango/player'
		])
			expect(voiceBack(bad).label).toBe('Back to Settings');
	});
});

describe('myCountHref', () => {
	it('carries where it came from and the pattern', () => {
		const href = myCountHref('/salsa/player?song=3&routine=2', 'son');
		const u = new URL(href, 'http://x');
		expect(u.pathname).toBe('/voice');
		expect(voiceBack(u.searchParams.get('from')).href).toBe('/salsa/player?song=3&routine=2');
		expect(u.searchParams.get('pattern')).toBe('son');
	});

	it('is bare /voice with neither', () => {
		expect(myCountHref()).toBe('/voice');
	});

	it('takes either one alone', () => {
		expect(myCountHref(undefined, 'all')).toBe('/voice?pattern=all');
		expect(new URL(myCountHref('/bachata/player'), 'http://x').searchParams.get('from')).toBe(
			'/bachata/player'
		);
	});
});

describe('voiceBack in Slovenian', () => {
	it('says where Back goes', () => {
		expect(withLocale('sl', () => voiceBack(null).label)).toBe('Nazaj: Nastavitve');
		expect(withLocale('sl', () => voiceBack('/salsa/player').label)).toBe('Nazaj: Vadenje');
	});
});
