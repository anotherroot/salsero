import { describe, expect, it } from 'vitest';
import { countsFor } from '$lib/beatgrid/beatgrid';
import { withLocale } from '$lib/i18n/current';
import { placeSections } from './sections';
import { listenLines } from './listen';
import { leadsOf } from './count-in';

// A beat every 0.5 s, a 1 every 8 beats (every 4 s).
const beats = Array.from({ length: 64 }, (_, i) => i * 0.5);
const counts = countsFor(64, [], 0);
const placed = placeSections(
	[
		{ at: 0, name: 'Verse', countOff: false },
		{ at: 16, name: 'Break', countOff: true },
		{ at: 20, name: 'Mambo', countOff: false }
	],
	beats,
	counts
);
const at = (beat: number, more: Partial<Parameters<typeof listenLines>[0]> = {}) => {
	const p = more.placed ?? placed;
	return listenLines({
		placed: p,
		counts,
		beat,
		t: beat < 0 ? 0 : beats[beat],
		leads: leadsOf(p, beats),
		anchors: 1,
		startS: 0,
		played: true,
		...more
	});
};

describe('the count card', () => {
	it('before play: the first section and its line', () => {
		expect(at(-1, { played: false })).toMatchObject({
			name: 'Verse',
			ahead: 'Break in 4 eights',
			pips: 4,
			off: false
		});
	});

	it('mid-section: the name, what is next and a pip per eight left', () => {
		expect(at(9)).toMatchObject({ name: 'Verse', ahead: 'Break in 3 eights', pips: 3 });
	});

	it('the last eight', () => {
		expect(at(25)).toMatchObject({ ahead: 'Break after this eight', pips: 1 });
	});

	it('a count-off section before a counted one: no number, beats left, the coming eights, then on the 1', () => {
		expect(at(34)).toMatchObject({
			name: 'Break',
			off: true,
			left: 6,
			ahead: 'Mambo in 1 eight',
			pips: 1
		});
		expect(at(37)).toMatchObject({ off: true, left: 3, ahead: 'Mambo on the 1', pips: 0 });
	});

	it('a count-off section with nothing counted after it: the line in beats', () => {
		const tail = placeSections(
			[
				{ at: 0, name: 'Verse', countOff: false },
				{ at: 16, name: 'Break', countOff: true },
				{ at: 20, name: 'Pause', countOff: true }
			],
			beats,
			counts
		);
		expect(at(34, { placed: tail })).toMatchObject({ ahead: 'Pause in 6 beats', pips: 0 });
	});

	it('the last section: its name and nothing next', () => {
		expect(at(50)).toMatchObject({ name: 'Mambo', ahead: null, pips: 0 });
	});

	it('before the first section: no name, a dash, the line points to it', () => {
		const later = placeSections([{ at: 8, name: 'Coro', countOff: false }], beats, counts);
		expect(at(2, { placed: later })).toMatchObject({
			name: null,
			ahead: 'Coro in 2 eights',
			off: true
		});
	});

	it('no sections and no 1s: the hint; with 1s, nothing', () => {
		expect(at(5, { placed: [], anchors: 0 })).toMatchObject({
			name: null,
			ahead: null,
			hint: true
		});
		expect(at(5, { placed: [], anchors: 2 })).toMatchObject({ hint: false });
	});

	it('says where the music starts until the song has played', () => {
		expect(at(-1, { played: false, startS: 18.2 }).startLine).toBe(
			'Starts at 0:18, where the music starts.'
		);
		expect(at(-1, { played: false, startS: 0.4 }).startLine).toBeNull();
		expect(at(40, { startS: 18.2 }).startLine).toBeNull();
		expect(withLocale('sl', () => at(-1, { played: false, startS: 18.2 }).startLine)).toBe(
			'Začne se pri 0:18, kjer se začne glasba.'
		);
	});
});
