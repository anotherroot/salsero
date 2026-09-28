import { describe, expect, it } from 'vitest';
import { SOURCES } from '$lib/labels';
import { EXERCISE_TYPES, TYPES, hasField, typeInfo, typeOf } from './kinds';

describe('exercise types', () => {
	it('maps every source to exactly one type, and every type is reachable', () => {
		const types = SOURCES.map(typeOf);
		expect(new Set(types)).toEqual(new Set(EXERCISE_TYPES));
		expect(typeOf('custom')).toBe('drill');
		expect(typeOf('lesson')).toBe('lesson');
		expect(typeOf('figure')).toBe('figure');
		expect(typeOf('routine')).toBe('routine');
	});

	it('gives reps to a drill only', () => {
		expect(SOURCES.filter((s) => hasField(s, 'reps'))).toEqual(['custom']);
	});

	it('gives every type minutes, a rating and a note', () => {
		for (const s of SOURCES) {
			expect(hasField(s, 'minutes')).toBe(true);
			expect(hasField(s, 'rating')).toBe(true);
			expect(hasField(s, 'note')).toBe(true);
		}
	});

	it('asks a lesson review about memory, the rest about how it went', () => {
		expect(typeInfo('lesson').ratingQuestion).toBe('How well do you remember it?');
		expect(TYPES.figure.ratingQuestion).toBe('How did it go?');
		expect(TYPES.drill.ratingQuestion).toBe('How did it go?');
	});
});
