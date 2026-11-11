/**
 * A judged drop as it is drawn (spec 1c.4–1c.6): the music's eights it ran over
 * (two or three rows), each target circle's state (blue when the person counted
 * from somewhere else), what the person counted over each, and a mark where
 * every tap fell, tied to the circle it counted for (look A). `until` shows only
 * what had happened by then (the replay). PURE.
 */
import { beatIndexAt } from '$lib/beatgrid/beatgrid';
import { timeline } from '$lib/scheduler/scheduler';
import type { DropAnswer } from './drops';
import type { Grid } from './judge';
import type { CircleState } from './round';

export interface JudgedRow {
	/** The target's positions in the music's count. */
	positions: number[];
	states: Record<number, CircleState>;
	/** Over a circle, the count the person meant it as (only when their count was off). */
	yours: Record<number, number>;
}

export interface TapMark {
	row: number;
	pos: number;
	stray: boolean;
	tie?: number;
	tieState?: CircleState;
}

/** The target's positions as the music counts them, when the person counted `shift` off. */
export function shiftedPositions(positions: number[], shift: number): number[] {
	return positions.map((p) => ((p - 1 + shift) % 8) + 1).sort((a, b) => a - b);
}

export function judgedRows(
	grid: Grid,
	answer: Pick<DropAnswer, 'eight' | 'beats' | 'taps' | 'shift'>,
	positions: number[],
	until = Infinity
): { rows: JudgedRow[]; marks: TapMark[] } {
	if (answer.eight === null || answer.beats.length === 0) return { rows: [], marks: [] };
	const tl = timeline(grid);
	const music = shiftedPositions(positions, answer.shift);
	const n = Math.max(...answer.beats.map((b) => b.row)) + 1;
	const rows: JudgedRow[] = Array.from({ length: n }, () => ({
		positions: music,
		states: Object.fromEntries(music.map((p) => [p, 'skip' as CircleState])),
		yours: {}
	}));
	const shown = (s: DropAnswer['beats'][number]['state']): CircleState =>
		s === 'miss' || s === 'skip' ? s : answer.shift ? 'shifted' : s;
	for (const b of answer.beats) {
		const row = rows[b.row];
		if (b.at > until) {
			row.states[b.pos] = 'future';
			continue;
		}
		row.states[b.pos] = shown(b.state);
		if (answer.shift) row.yours[b.pos] = b.yours;
	}
	const marks: TapMark[] = [];
	for (const tap of answer.taps) {
		if (tap > until) continue;
		const i = beatIndexAt(grid.beats, tap);
		if (i < 0) continue;
		const len = i + 1 < grid.beats.length ? grid.beats[i + 1] - grid.beats[i] : 0.5;
		const row = (tl.eights[i] ?? -1) - answer.eight;
		if (row < 0 || row >= n) continue;
		const pos = grid.counts[i] + (tap - grid.beats[i]) / len;
		const b = answer.beats.find((x) => x.offset !== null && Math.abs(x.at + x.offset - tap) < 1e-6);
		marks.push(
			b
				? { row, pos, stray: false, tie: b.pos, tieState: shown(b.state) }
				: { row, pos, stray: true }
		);
	}
	return { rows, marks };
}
