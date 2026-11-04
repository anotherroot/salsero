import { describe, expect, it } from 'vitest';
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
