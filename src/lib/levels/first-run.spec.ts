import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { afterJoin, afterSkip, codeRefusal, inviteCodeOf, joinStepHref, slides } from './first-run';

describe('the first run', () => {
	it('has three slides', () => {
		expect(slides().map((s) => s.title)).toEqual([
			'Practise what you learned in class',
			'A few things a day',
			'You say when it comes back'
		]);
	});
	// Catches: the first run drawn in English for a Slovenian reader.
	it('has three slides in Slovenian too', () => {
		const titles = withLocale('sl', () => slides().map((s) => s.title));
		expect(titles).toEqual([
			'Vadite, kar je bilo na tečaju',
			'Vsak dan le nekaj vaj',
			'Vi odločite, kdaj pride spet na vrsto'
		]);
	});
	it('refuses a bad class code in the reader’s language', () => {
		expect(codeRefusal('empty')).toBe('Enter the class code.');
		expect(codeRefusal('unknown')).toBe('No class has this code. Check it and try again.');
		expect(codeRefusal('refused')).toBe('This class was deleted, so it cannot be joined.');
		withLocale('sl', () => {
			expect(codeRefusal('empty')).toBe('Vnesite kodo tečaja.');
			expect(codeRefusal('unknown')).toBe(
				'Noben tečaj nima te kode. Preverite jo in poskusite znova.'
			);
			expect(codeRefusal('refused')).toBe(
				'Ta tečaj je bil izbrisan, zato se mu ne morete pridružiti.'
			);
		});
	});
	it('reads the code of the teacher link', () => {
		expect(inviteCodeOf('/g/ABC123')).toBe('ABC123');
		expect(inviteCodeOf('/g/ab%20c?x=1')).toBe('ab c');
		expect(inviteCodeOf('/salsa/groups')).toBeNull();
		expect(inviteCodeOf('/g/')).toBeNull();
	});
	it('ends on the joined class dance Today unless next is a real page', () => {
		expect(afterJoin('/', 'bachata')).toBe('/bachata');
		expect(afterJoin('/g/ABC', 'bachata')).toBe('/bachata');
		expect(afterJoin('/salsa/songs', 'bachata')).toBe('/salsa/songs');
	});
	it('does not send Not now back to the join link', () => {
		expect(afterSkip('/g/ABC')).toBe('/');
		expect(afterSkip('/salsa/songs')).toBe('/salsa/songs');
	});
	it('keeps next in the join step link', () => {
		expect(joinStepHref('/g/A B')).toBe('/welcome/start?step=join&next=%2Fg%2FA%20B');
	});
});
