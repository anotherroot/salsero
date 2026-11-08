import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { FEELS, RATING_OF, feelOf, feelWord } from './feel';

describe('feelOf', () => {
	it('round-trips the four faces', () => {
		expect(FEELS).toEqual(['hard', 'getting', 'gotit', 'easy']);
		for (const f of FEELS) expect(feelOf(RATING_OF[f])).toBe(f);
	});
	it('reads old stars', () => {
		expect(feelOf(3)).toBe('gotit');
		expect(feelOf(null)).toBeNull();
	});
});

describe('feelWord', () => {
	it('names each face in the current language', () => {
		expect(FEELS.map(feelWord)).toEqual(['Still hard', 'Getting there', "I've got it", 'Easy']);
		expect(withLocale('sl', () => FEELS.map(feelWord))).toEqual([
			'Še težko',
			'Napredujem',
			'Obvladam',
			'Lahko'
		]);
	});
});
