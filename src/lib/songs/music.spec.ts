import { describe, expect, it } from 'vitest';
import { MUSIC, practiseHref } from './music';

describe('practiseHref', () => {
	it("opens a routine's practice with the song, the person's entry kept", () => {
		expect(practiseHref('salsa', { routineId: 14, entryId: 7 }, 3)).toBe(
			'/salsa/player?routine=14&exercise=7&song=3'
		);
		expect(practiseHref('salsa', { routineId: 14, entryId: null }, 3)).toBe(
			'/salsa/player?routine=14&song=3'
		);
	});
	it("opens a drill's practice on the person's own exercise", () => {
		expect(practiseHref('bachata', { drillEntryId: 9 }, 3)).toBe(
			'/bachata/player?exercise=9&song=3'
		);
	});
	it('opens the player with just the song from a lesson', () => {
		expect(practiseHref('salsa', { lesson: true }, 3)).toBe('/salsa/player?song=3');
	});
});

describe('MUSIC', () => {
	it('holds the words the list and its sheets use', () => {
		expect(MUSIC).toMatchObject({
			heading: 'Music',
			add: 'Add a song',
			noteLabel: 'Note',
			notePlaceholder: 'What to practise to it',
			noteHelp: 'Members see it under the song.',
			addButton: 'Add to Music',
			save: 'Save',
			practise: 'Practise to this',
			edit: 'Edit note',
			remove: 'Remove',
			notShared: 'Not shared',
			pick: 'Pick a song'
		});
	});
});
