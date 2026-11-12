import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { t } from '$lib/i18n/catalog';
import { SOURCES } from '$lib/labels';
import { EXERCISE_TYPES, TYPES, typeOf } from './kinds';

describe('exercise types', () => {
	it('maps every source to exactly one type, and every type is reachable', () => {
		const types = [
			...SOURCES.map((source) => typeOf({ source })),
			typeOf({ source: 'custom', kind: 'hearing' })
		];
		expect(new Set(types)).toEqual(new Set(EXERCISE_TYPES));
		expect(typeOf({ source: 'custom' })).toBe('drill');
		// A group drill's entry opens the drill page, like a drill of one's own.
		expect(typeOf({ source: 'added' })).toBe('drill');
		expect(typeOf({ source: 'lesson' })).toBe('lesson');
		expect(typeOf({ source: 'figure' })).toBe('figure');
		expect(typeOf({ source: 'routine' })).toBe('routine');
	});

	it('a drill of the hearing kind is a hearing drill, an entry for one too', () => {
		expect(typeOf({ source: 'custom', kind: 'hearing' })).toBe('hearing');
		expect(typeOf({ source: 'added', kind: 'hearing' })).toBe('hearing');
		expect(typeOf({ source: 'custom', kind: null })).toBe('drill');
	});

	it('a type is its name and its label, nothing else', () => {
		expect({ ...TYPES.drill }).toEqual({ type: 'drill', label: 'Drill' });
		expect(Object.keys(TYPES.figure)).toEqual(['type', 'label']);
	});
});

describe('exercise types in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);

	it('names each type, read when asked', () => {
		expect(sl(() => EXERCISE_TYPES.map((x) => TYPES[x].label))).toEqual([
			'Ponavljanje lekcije',
			'Vaja z figuro',
			'Vaja',
			'Kombinacija',
			'Sluh'
		]);
		// Read at call time: the same object answers in English outside.
		expect(TYPES.drill.label).toBe('Drill');
	});
});

describe('the type registry: Practise with', () => {
	const src = readFileSync(join(__dirname, '../components/exercises/kinds/index.ts'), 'utf8');

	it('has a practice component for every type, a lesson included', () => {
		expect(src).toMatch(/export const practiceFor/);
		const map = /const PRACTICE[^=]*=\s*\{([^}]*)\}/.exec(src)?.[1] ?? '';
		for (const type of ['figure', 'drill', 'routine', 'lesson', 'hearing'])
			expect(map).toMatch(new RegExp(`${type}:\\s*\\w+Practice`));
	});

	it('asks the page for recordings and a practice snippet, and no longer for editLinks', () => {
		expect(src).toMatch(/practice\?: Snippet/);
		expect(src).toMatch(/recordings\?:/);
		expect(src).not.toMatch(/editLinks/);
	});
});

describe('the exercise content words', () => {
	it('counts the recordings, in both languages', () => {
		expect(t().exercise.content.recordings(0)).toBe('Recordings');
		expect(t().exercise.content.recordings(3)).toBe('Recordings · 3');
		expect(withLocale('sl', () => t().exercise.content.recordings(3))).toBe('Posnetki · 3');
	});
});
