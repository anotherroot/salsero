import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { REVIEW_PREFIX, shownExercise } from './name';

const review = { id: 1, name: `${REVIEW_PREFIX}Druga lekcija`, source: 'lesson' };

describe('shownExercise', () => {
	it('draws a lesson’s own exercise as stored in English', () => {
		expect(shownExercise(review).name).toBe('Review: Druga lekcija');
	});

	it('draws it in Slovenian for a Slovenian reader, keeping the other fields', () => {
		const shown = withLocale('sl', () => shownExercise(review));
		expect(shown).toEqual({ id: 1, name: 'Ponovitev: Druga lekcija', source: 'lesson' });
	});

	it('leaves a person’s own words alone: other kinds, and a name without the prefix', () => {
		withLocale('sl', () => {
			const drill = { name: 'Review: my notes', source: 'custom' };
			expect(shownExercise(drill)).toBe(drill);
			const odd = { name: 'Tuesday', source: 'lesson' };
			expect(shownExercise(odd)).toBe(odd);
		});
	});
});
