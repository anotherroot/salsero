import { describe, expect, it } from 'vitest';
import { addSections, holdsLine, newLine } from './add';
import type { AddItem } from '$lib/types';

const item = (kind: AddItem['kind'], id: number): AddItem => ({
	kind,
	id,
	name: `${kind} ${id}`,
	ticked: kind !== 'figure'
});

describe('holdsLine', () => {
	it('says what the lesson holds, in order, plural where due', () => {
		expect(holdsLine({ videos: 1, sections: 6, figures: 5, routines: 1, drills: 2 })).toBe(
			'1 video · 6 sections · 5 figures · 1 routine · 2 drills'
		);
	});
	it('leaves zeros out, and says so when there is nothing', () => {
		expect(holdsLine({ videos: 0, sections: 0, figures: 1, routines: 0, drills: 0 })).toBe(
			'1 figure'
		);
		expect(holdsLine({ videos: 0, sections: 0, figures: 0, routines: 0, drills: 0 })).toBe(
			'Nothing in it yet'
		);
	});
});

describe('addSections', () => {
	it('puts the lesson, routines and drills on Today and the figures apart', () => {
		const s = addSections([
			item('lesson', 1),
			item('routine', 2),
			item('drill', 3),
			item('figure', 4)
		]);
		expect(s.today.map((i) => i.kind)).toEqual(['lesson', 'routine', 'drill']);
		expect(s.figures.map((i) => i.id)).toEqual([4]);
	});
});

describe('newLine', () => {
	it('counts new drills and routines', () => {
		expect(newLine([item('drill', 1)])).toBe('1 new drill');
		expect(newLine([item('drill', 1), item('drill', 2)])).toBe('2 new drills');
		expect(newLine([item('routine', 3), item('drill', 1)])).toBe('1 new routine · 1 new drill');
	});
});
