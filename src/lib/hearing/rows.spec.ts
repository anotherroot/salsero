import { describe, expect, it } from 'vitest';
import { judgeDropPattern } from './drops';
import { judgedRows } from './rows';

const grid = {
	beats: Array.from({ length: 400 }, (_, i) => i * 0.5),
	counts: Array.from({ length: 400 }, (_, i) => (i % 8) + 1)
};
const EVERY = [1, 2, 3, 4, 5, 6, 7, 8];
const onBeats = (from: number, to: number) =>
	Array.from({ length: to - from }, (_, i) => (from + i) * 0.5);

describe('judgedRows', () => {
	it('draws a drop counted from the 5 over three of the music eights, blue, with what you counted', () => {
		const d = judgeDropPattern(grid, EVERY, 0, onBeats(4, 20));
		const r = judgedRows(grid, d, EVERY);
		expect(r.rows).toHaveLength(3);
		expect(r.rows[0].states).toMatchObject({ 1: 'skip', 4: 'skip', 5: 'shifted', 8: 'shifted' });
		expect(r.rows[2].states).toMatchObject({ 4: 'shifted', 5: 'skip' });
		expect(r.rows[0].yours[5]).toBe(1);
		expect(r.marks).toHaveLength(16);
		expect(r.marks[0]).toMatchObject({ row: 0, tie: 5, tieState: 'shifted', stray: false });
	});

	it('draws the right count green and a stray tap red, untied', () => {
		const d = judgeDropPattern(grid, EVERY, 0, [...onBeats(0, 16), 3.25]);
		const r = judgedRows(grid, d, EVERY);
		expect(r.rows).toHaveLength(2);
		expect(r.rows[0].states[1]).toBe('spot');
		expect(r.rows[0].yours).toEqual({});
		const stray = r.marks.filter((m) => m.stray);
		expect(stray).toHaveLength(1);
		expect(stray[0].tie).toBeUndefined();
	});

	it('shows only what has happened by `until` (the replay)', () => {
		const d = judgeDropPattern(grid, EVERY, 0, onBeats(0, 16));
		const r = judgedRows(grid, d, EVERY, 2.1);
		expect(r.rows[0].states[5]).toBe('spot');
		expect(r.rows[0].states[6]).toBe('future');
		expect(r.marks).toHaveLength(5);
	});
});
