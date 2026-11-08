import { describe, expect, it } from 'vitest';
import { mergeDay } from './day-entry';

const row = (
	doneAt: number,
	durationS: number | null,
	rating: number | null,
	note: string | null,
	reps: number | null = null
) => ({ doneAt, durationS, reps, rating, note });

describe('mergeDay', () => {
	it('adds minutes, keeps the last rated face, joins notes in time order', () => {
		expect(mergeDay([row(3, null, 4, 'b'), row(1, 240, 2, 'a'), row(2, 120, null, null)])).toEqual({
			durationS: 360,
			reps: null,
			rating: 4,
			note: 'a · b'
		});
	});
	it('takes the last RATED face, not the last row', () => {
		expect(mergeDay([row(1, null, 5, null), row(2, null, null, null)]).rating).toBe(5);
	});
	it('adds old reps, and is null when no row has any', () => {
		expect(mergeDay([row(1, null, null, null, 10), row(2, null, null, null, 30)]).reps).toBe(40);
		expect(mergeDay([row(1, null, null, null)])).toEqual({
			durationS: null,
			reps: null,
			rating: null,
			note: null
		});
	});
	it('does not mutate its input order', () => {
		const rows = [row(2, 1, null, 'y'), row(1, 1, null, 'x')];
		mergeDay(rows);
		expect(rows[0].doneAt).toBe(2);
	});
});
