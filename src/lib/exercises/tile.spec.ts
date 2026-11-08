import { describe, expect, it } from 'vitest';
import { withLocale } from '$lib/i18n/current';
import { ICONS } from '$lib/icons/icons';
import { exerciseTile } from './tile';

describe('exerciseTile', () => {
	it('maps each kind to an icon and a label', () => {
		expect(exerciseTile({ source: 'figure', partner: 'partner' })).toEqual({
			icon: 'people',
			label: 'Figure, partner'
		});
		expect(exerciseTile({ source: 'figure', partner: null })).toEqual({
			icon: 'people',
			label: 'Figure, partner'
		});
		expect(exerciseTile({ source: 'figure', partner: 'solo' })).toEqual({
			icon: 'solo',
			label: 'Figure, solo'
		});
		expect(exerciseTile({ source: 'routine', partner: null }).icon).toBe('route');
		expect(exerciseTile({ source: 'lesson', partner: null })).toEqual({
			icon: 'lessons',
			label: 'Lesson review'
		});
		expect(exerciseTile({ source: 'custom', partner: null })).toEqual({
			icon: 'metronome',
			label: 'Drill'
		});
	});

	it('only returns icons that exist', () => {
		for (const source of ['figure', 'routine', 'lesson', 'custom'] as const)
			for (const partner of ['partner', 'solo', null] as const)
				expect(ICONS[exerciseTile({ source, partner }).icon]).toBeTruthy();
	});
});

describe('exerciseTile in Slovenian', () => {
	const sl = <T>(fn: () => T) => withLocale('sl', fn);
	it('names each kind', () => {
		const label = (source: 'figure' | 'routine' | 'lesson' | 'custom', partner: 'solo' | null) =>
			sl(() => exerciseTile({ source, partner }).label);
		expect(label('figure', null)).toBe('Različica, v paru');
		expect(label('figure', 'solo')).toBe('Različica, solo');
		expect(label('routine', null)).toBe('Kombinacija');
		expect(label('lesson', null)).toBe('Ponavljanje lekcije');
		expect(label('custom', null)).toBe('Vaja');
	});
});
