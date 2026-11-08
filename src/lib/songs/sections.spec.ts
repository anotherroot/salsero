import { describe, expect, it } from 'vitest';
import { countsFor, scaleBeats } from '$lib/beatgrid/beatgrid';
import { withLocale } from '$lib/i18n/current';
import {
	addSectionAt,
	aheadLine,
	aheadOf,
	editSection,
	gridRows,
	moveSection,
	parseSections,
	placeSections,
	removeSection,
	sectionIndexAt,
	sectionName,
	sectionsJson
} from './sections';

describe('parseSections', () => {
	it('reads bad JSON as no sections and drops bad entries', () => {
		for (const bad of [null, undefined, '', 'null', '{}', '{x', '[1]']) {
			expect(parseSections(bad)).toEqual([]);
		}
		expect(
			parseSections(
				'[{"at":"x","name":"A","countOff":false},{"at":4,"name":"B","countOff":false},{"at":-1,"name":"C","countOff":false},{"at":2,"name":3,"countOff":false},{"at":3,"name":"D","countOff":"yes"}]'
			)
		).toEqual([{ at: 4, name: 'B', countOff: false }]);
		expect(
			parseSections(JSON.stringify([{ at: 1, name: 'x'.repeat(300), countOff: true }]))[0].name
		).toHaveLength(40);
	});

	it('sorts by time and trims names', () => {
		expect(
			parseSections(
				JSON.stringify([
					{ at: 9, name: ' Mambo ', countOff: false },
					{ at: 1, name: 'Intro', countOff: true }
				])
			)
		).toEqual([
			{ at: 1, name: 'Intro', countOff: true },
			{ at: 9, name: 'Mambo', countOff: false }
		]);
	});

	it('writes the canonical JSON it reads back', () => {
		const list = [
			{ at: 9, name: 'Mambo', countOff: false },
			{ at: 1, name: '', countOff: true }
		];
		const json = sectionsJson(list);
		expect(json).toBe(
			'[{"at":1,"name":"","countOff":true},{"at":9,"name":"Mambo","countOff":false}]'
		);
		expect(parseSections(json)).toEqual(parseSections(JSON.stringify(list)));
	});
});

// A click grid: a beat every 0.5 s, a 1 every 8 beats (every 4 s).
const beats = Array.from({ length: 64 }, (_, i) => i * 0.5);
const counts = countsFor(64, [], 0);
const S = (at: number, name = '', countOff = false) => ({ at, name, countOff });

describe('placeSections', () => {
	it('snaps to the nearest 1 in order, so a crowded later section moves on and none is lost', () => {
		const list = [S(8, 'Break', true), S(10, 'Mambo')];
		// ×½: a beat a second, a 1 every 8 of those (every 8 s)
		const half = scaleBeats(beats, 0.5);
		const placedHalf = placeSections(list, half, countsFor(half.length, [], 0));
		expect(placedHalf.map((p) => p.t)).toEqual([8, 16]);
		// back at ×1 both sit where they did
		expect(placeSections(list, beats, counts).map((p) => [p.t, p.beat, p.index])).toEqual([
			[8, 16, 0],
			[12, 24, 1]
		]);
	});

	it('drops a section with no 1 left after the one before it', () => {
		const list = [S(28), S(29), S(31)];
		expect(placeSections(list, beats, counts).map((p) => p.t)).toEqual([28]);
	});

	it('follows the 1s when they change', () => {
		const moved = countsFor(64, [2], 0);
		expect(placeSections([S(4)], beats, moved)[0].beat).toBe(10);
	});

	it('places nothing without beats', () => {
		expect(placeSections([S(4)], [], [])).toEqual([]);
	});
});

describe('gridRows', () => {
	it('starts rows at every 1, marks short rows and the lead', () => {
		const rows = gridRows(beats, countsFor(64, [2, 20], 0), [], 0);
		expect(rows[0]).toMatchObject({ start: 0, end: 2, lead: true, short: null });
		expect(rows[1]).toMatchObject({ start: 2, end: 10, lead: false, short: null });
		expect(rows.find((r) => r.start === 18)).toMatchObject({ end: 20, short: 2 });
		expect(rows.at(-1)).toMatchObject({ end: 64, short: null });
	});

	it('names the row a section starts on, and marks rows before the music', () => {
		const placed = placeSections([S(4, 'Verse')], beats, counts);
		const rows = gridRows(beats, counts, placed, 9);
		expect(rows.map((r) => r.section)).toEqual([null, 0, null, null, null, null, null, null]);
		expect(rows.map((r) => r.quiet)).toEqual([
			true,
			true,
			false,
			false,
			false,
			false,
			false,
			false
		]);
		expect(gridRows(beats, counts, placed, 0.6).some((r) => r.quiet)).toBe(false);
	});

	it('draws rows from stray anchors without throwing', () => {
		expect(gridRows(beats, countsFor(64, [500, -3], 0), [], 0)).toHaveLength(8);
	});
});

describe('what is next', () => {
	const placed = placeSections([S(0, 'Break', true), S(4, 'Verse'), S(16, 'Mambo')], beats, counts);

	it('knows which section a beat is in', () => {
		expect(sectionIndexAt(placed, 3)).toBe(0);
		expect(sectionIndexAt(placed, 8)).toBe(1);
		const later = placeSections([S(4, 'Verse')], beats, counts);
		expect(sectionIndexAt(later, 2)).toBe(-1);
	});

	it('reads eights, the last eight, and beats in a count-off section', () => {
		expect(aheadOf(placed, counts, 2)).toMatchObject({ mode: 'beats', beatsLeft: 6 });
		expect(aheadOf(placed, counts, 8)).toMatchObject({ mode: 'eights', eightsLeft: 3 });
		expect(aheadOf(placed, counts, 24)).toMatchObject({ mode: 'last', eightsLeft: 1 });
		expect(aheadOf(placed, counts, 40)).toBeNull();
		expect(aheadLine(aheadOf(placed, counts, 8)!)).toBe('Mambo in 3 eights');
		expect(aheadLine(aheadOf(placed, counts, 24)!)).toBe('Mambo after this eight');
		expect(aheadLine(aheadOf(placed, counts, 2)!)).toBe('Verse in 6 beats');
		expect(aheadLine(aheadOf(placed, counts, 7)!)).toBe('Verse in 1 beat');
	});

	it('points to the first section before it starts', () => {
		const later = placeSections([S(4, 'Verse')], beats, counts);
		expect(aheadOf(later, counts, 0)).toMatchObject({ mode: 'last', eightsLeft: 1 });
		expect(aheadOf(later, counts, 0)!.next.name).toBe('Verse');
	});

	it('reads in Slovenian', () => {
		withLocale('sl', () => {
			expect(aheadLine(aheadOf(placed, counts, 8)!)).toBe('Mambo čez 3 osmice');
			expect(aheadLine(aheadOf(placed, counts, 2)!)).toBe('Verse čez 6 dob');
		});
	});
});

describe('section writes', () => {
	// A on beat 8 (4 s), B on beat 16 (8 s)
	const list = [S(4, 'A'), S(8, 'B')];
	const placed = placeSections(list, beats, counts);

	it('refuses a second section on a 1, else adds an unnamed one there', () => {
		expect(addSectionAt(list, placed, beats, 8)).toBe('taken');
		expect(addSectionAt(list, placed, beats, 24)).toEqual([...list, S(12)]);
	});

	it('moves by an eight within the song, never onto or past a neighbour', () => {
		expect(moveSection(list, placed, beats, counts, 0, 1)).toBe('taken');
		expect(moveSection(list, placed, beats, counts, 0, -1)).toEqual([S(0, 'A'), list[1]]);
		expect(moveSection(list, placed, beats, counts, 1, 1)).toEqual([list[0], S(12, 'B')]);
		const first = [S(0, 'A')];
		expect(moveSection(first, placeSections(first, beats, counts), beats, counts, 0, -1)).toBe(
			'ends'
		);
		const last = [S(28, 'Z')];
		expect(moveSection(last, placeSections(last, beats, counts), beats, counts, 0, 1)).toBe('ends');
		expect(moveSection(list, placed, beats, counts, 5, 1)).toBe('missing');
	});

	it('renames, turns the count off, and removes', () => {
		expect(editSection(list, 1, { name: ' Coro ', countOff: true })).toEqual([
			list[0],
			S(8, 'Coro', true)
		]);
		expect(editSection(list, 0, { name: 'x'.repeat(60) })![0].name).toHaveLength(40);
		expect(editSection(list, 2, { name: 'x' })).toBe('missing');
		expect(removeSection(list, 0)).toEqual([list[1]]);
		expect(removeSection(list, -1)).toBe('missing');
	});

	it('draws the unnamed section in the reader’s language', () => {
		expect(sectionName({ name: '' })).toBe('Section');
		expect(sectionName({ name: 'Mambo' })).toBe('Mambo');
		expect(withLocale('sl', () => sectionName({ name: '' }))).toBe('Del');
	});
});
