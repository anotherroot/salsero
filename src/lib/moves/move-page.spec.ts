import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { moveSubtitle, usedInMeta } from './move-page';

describe('moveSubtitle', () => {
	it('counts the figures', () => {
		expect(moveSubtitle(3)).toBe('Move · 3 figures');
		expect(moveSubtitle(1)).toBe('Move · 1 figure');
	});
});

describe('usedInMeta', () => {
	it('names the figures a routine uses', () => {
		expect(usedInMeta('routine', ['Doble'])).toBe('Routine · Doble');
		expect(usedInMeta('routine', ['Doble', 'Básica'])).toBe('Routine · Doble and Básica');
		expect(usedInMeta('routine', ['Doble', 'Básica', 'Simple'])).toBe(
			'Routine · Doble, Básica and Simple'
		);
	});
	it('says only Lesson for a lesson', () => {
		expect(usedInMeta('lesson', ['Doble'])).toBe('Lesson');
	});
});

describe('in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it("counts a move's figures as različice", () => {
		expect(sl(() => moveSubtitle(1))).toBe('Figura · 1 različica');
		expect(sl(() => moveSubtitle(2))).toBe('Figura · 2 različici');
		expect(sl(() => moveSubtitle(3))).toBe('Figura · 3 različice');
		expect(sl(() => moveSubtitle(5))).toBe('Figura · 5 različic');
	});

	it('joins the names with "in"', () => {
		expect(sl(() => usedInMeta('routine', ['A', 'B', 'C']))).toBe('Kombinacija · A, B in C');
		expect(sl(() => usedInMeta('routine', ['A']))).toBe('Kombinacija · A');
		expect(sl(() => usedInMeta('routine', []))).toBe('Kombinacija');
		expect(sl(() => usedInMeta('lesson', []))).toBe('Lekcija');
	});
});
