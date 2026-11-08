import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { t } from '$lib/i18n/catalog';
import { SOURCES } from '$lib/labels';
import { EXERCISE_TYPES, TYPES, hasField, typeInfo, typeOf } from './kinds';

describe('exercise types', () => {
	it('maps every source to exactly one type, and every type is reachable', () => {
		const types = SOURCES.map(typeOf);
		expect(new Set(types)).toEqual(new Set(EXERCISE_TYPES));
		expect(typeOf('custom')).toBe('drill');
		// A group drill's entry opens the drill popup, like a drill of one's own.
		expect(typeOf('added')).toBe('drill');
		expect(typeOf('lesson')).toBe('lesson');
		expect(typeOf('figure')).toBe('figure');
		expect(typeOf('routine')).toBe('routine');
	});

	it('gives reps to a drill and its group entry only', () => {
		expect(SOURCES.filter((s) => hasField(s, 'reps'))).toEqual(['custom', 'added']);
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

	it('puts a figure and a drill content left, a routine and a lesson right', () => {
		expect(TYPES.figure.paneContent).toBe('left');
		expect(TYPES.drill.paneContent).toBe('left');
		expect(TYPES.routine.paneContent).toBe('right');
		expect(TYPES.lesson.paneContent).toBe('right');
	});
});

describe('exercise types in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('names each type, read when asked', () => {
		expect(sl(() => EXERCISE_TYPES.map((x) => TYPES[x].label))).toEqual([
			'Ponavljanje lekcije',
			'Vaja z različico',
			'Vaja',
			'Kombinacija'
		]);
		// Read at call time: the same object answers in English outside.
		expect(TYPES.drill.label).toBe('Drill');
	});

	it('asks a lesson review about memory, the rest about how it went', () => {
		expect(sl(() => typeInfo('lesson').ratingQuestion)).toBe('Kako dobro se je spomnite?');
		expect(sl(() => typeInfo('custom').ratingQuestion)).toBe('Kako je šlo?');
	});
});

describe('the type registry: Practise with', () => {
	const src = readFileSync(join(__dirname, '../components/exercises/kinds/index.ts'), 'utf8');

	it('has a practice component for a drill, a figure and a routine, and none for a lesson', () => {
		expect(src).toMatch(/export const practiceFor/);
		const map = /const PRACTICE[^=]*=\s*\{([^}]*)\}/.exec(src)?.[1] ?? '';
		expect(map).toMatch(/lesson:\s*null/);
		for (const type of ['figure', 'drill', 'routine'])
			expect(map).toMatch(new RegExp(`${type}:\\s*\\w+Practice`));
	});

	it('asks the page for recordings and a practice snippet, and no longer for editLinks', () => {
		expect(src).toMatch(/practice\?: Snippet/);
		expect(src).toMatch(/recordings\?:/);
		expect(src).not.toMatch(/editLinks/);
	});
});

describe('the exercise content words', () => {
	it('points the routine note at Done and counts the recordings, in both languages', () => {
		expect(t().exercise.content.routineNote).toBe(
			'A run there saves itself. Tap Done when you practised away from the app.'
		);
		expect(t().exercise.content.recordings(0)).toBe('Recordings');
		expect(t().exercise.content.recordings(3)).toBe('Recordings · 3');
		expect(withLocale('sl', () => t().exercise.content.recordings(3))).toBe('Posnetki · 3');
	});
});
