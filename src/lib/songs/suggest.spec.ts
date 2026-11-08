import { describe, expect, it } from 'vitest';
import { countsFor, scaleBeats } from '$lib/beatgrid/beatgrid';
import { placeSections } from './sections';
import { suggestions } from './suggest';

// 128 stored beats, one every 0.5 s. The downbeats hold phase 0 for 16 bars,
// then phase 1 (the 1 moved a beat later at beat 65).
const raw = Array.from({ length: 128 }, (_, i) => i * 0.5);
const at = (from: number, to: number) => {
	const out: number[] = [];
	for (let j = from; j <= to; j += 4) out.push(raw[j]);
	return out;
};
const downbeats = [...at(0, 60), ...at(65, 125)];
const plain = {
	raw,
	downbeats,
	beats: raw,
	counts: countsFor(128, [], 0),
	anchors: [] as number[],
	placed: [],
	tempoFactor: 1 as const
};

describe('suggestions', () => {
	it('suggests where the downbeats move away from the count', () => {
		expect(suggestions(plain)).toEqual([{ beat: 65, t: 32.5, shift: 1 }]);
	});

	it('suggests nothing once the count follows them', () => {
		expect(suggestions({ ...plain, counts: countsFor(128, [0, 65], 0), anchors: [0, 65] })).toEqual(
			[]
		);
		expect(suggestions({ ...plain, counts: countsFor(128, [1], 0), anchors: [] })).toHaveLength(1);
	});

	it('takes a short run of a new phase as noise', () => {
		const blip = [...at(0, 60), raw[65], raw[69], ...at(72, 124)];
		expect(suggestions({ ...plain, downbeats: blip })).toEqual([]);
	});

	it('stays away from an anchor and out of a count-off section', () => {
		expect(suggestions({ ...plain, anchors: [60] })).toEqual([]);
		const placed = placeSections([{ at: 30, name: 'Break', countOff: true }], raw, plain.counts);
		expect(suggestions({ ...plain, placed })).toEqual([]);
	});

	it('reads a 2-beat move as later', () => {
		const two = [...at(0, 60), ...at(66, 126)];
		expect(suggestions({ ...plain, downbeats: two })).toEqual([{ beat: 66, t: 33, shift: 2 }]);
		const back = [...at(0, 60), ...at(67, 123)];
		expect(suggestions({ ...plain, downbeats: back })).toEqual([{ beat: 67, t: 33.5, shift: -1 }]);
	});

	it('counts the shift in the counted beats at ×2, and gives none at ×½ for an odd move', () => {
		const double = scaleBeats(raw, 2);
		expect(
			suggestions({
				...plain,
				beats: double,
				counts: countsFor(double.length, [], 0),
				tempoFactor: 2
			})
		).toEqual([{ beat: 130, t: 32.5, shift: 2 }]);
		const half = scaleBeats(raw, 0.5);
		expect(
			suggestions({
				...plain,
				beats: half,
				counts: countsFor(half.length, [], 0),
				tempoFactor: 0.5
			})
		).toEqual([]);
	});

	it('gives nothing, without throwing, when the inputs do not fit', () => {
		expect(suggestions({ ...plain, downbeats: [] })).toEqual([]);
		expect(suggestions({ ...plain, raw: raw.slice(0, 3), beats: raw.slice(0, 3) })).toEqual([]);
		expect(suggestions({ ...plain, anchors: [500, -2] })).toHaveLength(1);
		expect(suggestions({ ...plain, beats: [], counts: [] })).toEqual([]);
	});
});
