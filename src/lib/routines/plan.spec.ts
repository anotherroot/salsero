import { describe, expect, it } from 'vitest';
import type { Graph } from '$lib/graph/graph';
import { LEAD_IN_8S, type PlanStep } from '$lib/scheduler/scheduler';
import { routinePlan } from './plan';
import type { RoutineShape } from './routines';

/**
 * Same graph as routines.spec.ts: 1 open, 2 closed, 3 hammerlock. 10 has no
 * position; 15 ends in closed or hammerlock.
 */
const g: Graph = {
	positions: [],
	figures: [
		{ id: 10, starts: [], ends: [], start: 1, length: 8 },
		{ id: 11, starts: [1], ends: [2], start: 1, length: 8 },
		{ id: 12, starts: [2], ends: [1], start: 1, length: 8 },
		{ id: 13, starts: [1, 2], ends: [3], start: 1, length: 16 },
		{ id: 14, starts: [3], ends: [1], start: 1, length: 8 },
		{ id: 15, starts: [1], ends: [2, 3], start: 1, length: 8 }
	]
};

const opts = (...figureIds: number[]): RoutineShape => ({
	slots: figureIds.map((id) => ({ kind: 'options', figureIds: [id] }))
});

/** A rand that walks a fixed list, so a plan is reproducible. */
const seeded = (values: number[]) => {
	let i = 0;
	return () => values[i++ % values.length];
};

describe('routinePlan', () => {
	it('walks the slots in order, starting after the lead-in', () => {
		const plan = routinePlan([], opts(11, 12), g, 3, seeded([0]));
		expect(plan).toEqual([
			{ eight: LEAD_IN_8S, figureId: 11, slot: 0 },
			{ eight: LEAD_IN_8S + 1, figureId: 12, slot: 1 }
		]);
	});

	it('loops back to the first slot when the song outlasts the routine', () => {
		const plan = routinePlan([], opts(11, 12), g, 6, seeded([0]));
		expect(plan.map((s) => s.figureId)).toEqual([11, 12, 11, 12, 11]);
	});

	it('gives each figure its own length', () => {
		// 13 is 16 counts, two eights; 14 is one.
		const plan = routinePlan([], opts(13, 14), g, 5, seeded([0]));
		expect(plan).toEqual([
			{ eight: 2, figureId: 13, slot: 0 },
			{ eight: 4, figureId: 14, slot: 1 },
			{ eight: 5, figureId: 13, slot: 0 }
		]);
	});

	it('restarts at a chosen slot from a chosen 8-count (a jump)', () => {
		const shape = opts(11, 12, 13, 14);
		const first = routinePlan([], shape, g, 6, seeded([0]));
		const jumped = routinePlan(first, shape, g, 9, seeded([0]), { eight: 3, slot: 3 });
		// The step before the jump stays; from 8-count 3 the walk is 14, then the loop.
		expect(jumped.slice(0, 1)).toEqual(first.slice(0, 1));
		expect(jumped.slice(1, 4)).toEqual([
			{ eight: 3, figureId: 14, slot: 3 },
			{ eight: 4, figureId: 11, slot: 0 },
			{ eight: 5, figureId: 12, slot: 1 }
		]);
	});

	it('jumps back to a slot already danced, dropping what was planned after it', () => {
		const shape = opts(11, 12, 14);
		const first = routinePlan([], shape, g, 8, seeded([0]));
		const jumped = routinePlan(first, shape, g, 8, seeded([0]), { eight: 6, slot: 0 });
		expect(jumped.filter((s) => s.eight >= 6).map((s) => [s.eight, s.slot])).toEqual([
			[6, 0],
			[7, 1],
			[8, 2]
		]);
		expect(jumped.filter((s) => s.eight < 6)).toEqual(first.filter((s) => s.eight < 6));
	});

	it('resumes an existing plan without touching what it already decided', () => {
		const first = routinePlan([], opts(11, 12), g, 3, seeded([0]));
		const second = routinePlan(first, opts(11, 12), g, 5, seeded([0]));
		expect(second.slice(0, first.length)).toEqual(first);
		expect(second.map((s) => s.figureId)).toEqual([11, 12, 11, 12]);
	});

	it('extends the plan it was given rather than rebuilding one', () => {
		// A prefix this routine could never have produced: 14 is in none of its
		// slots, and 7 is not where a lead-in starts. A `routinePlan` that
		// recomputed from scratch would overwrite both.
		//
		// The test above cannot tell the two apart, because the algorithm is
		// deterministic and that test hands the second call a fresh rand stream —
		// so a from-scratch rebuild reproduces a correct resume exactly.
		const given: PlanStep[] = [{ eight: 7, figureId: 14, slot: 1 }];
		const out = routinePlan(given, opts(11, 12), g, 9, seeded([0]));
		expect(out[0]).toEqual({ eight: 7, figureId: 14, slot: 1 });
		// It follows the given step's slot: slot 1 was the last, so slot 0 is next.
		expect(out[1]).toEqual({ eight: 8, figureId: 11, slot: 0 });
		expect(out.length).toBeGreaterThan(1);
	});

	it('picks the option that can be entered from where the hands are', () => {
		// Slot 1 is 11 (open → closed). Slot 2 offers 14 (needs hammerlock) and
		// 12 (needs closed). Only 12 fits, whatever rand says.
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'options', figureIds: [14, 12] }
			]
		};
		for (const r of [0, 0.5, 0.99]) {
			// r = 0 is the load-bearing case: with two options, 0.5 and 0.99 land on the
			// right answer even if the position filter is skipped entirely. Do not trim it.
			expect(routinePlan([], shape, g, 3, seeded([r])).map((s) => s.figureId)).toEqual([11, 12]);
		}
	});

	it('from a figure with two ends, picks an option starting in one of them', () => {
		// 15 ends closed or hammerlock. Slot 2 offers 11 (needs open) and 12 (needs closed).
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [15] },
				{ kind: 'options', figureIds: [11, 12] }
			]
		};
		for (const r of [0, 0.5, 0.99]) {
			expect(routinePlan([], shape, g, 3, seeded([r])).map((s) => s.figureId)).toEqual([15, 12]);
		}
	});

	it('always counts an option with no starts as one that fits', () => {
		// 11 ends closed. Slot 2 offers 14 (needs hammerlock) and 10 (fits anywhere).
		// r = 0 would pick 14 if 10 were not eligible.
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'options', figureIds: [14, 10] }
			]
		};
		expect(routinePlan([], shape, g, 3, seeded([0])).map((s) => s.figureId)).toEqual([11, 10]);
	});

	it('spreads across the options that fit, driven by rand', () => {
		// After 12 the hands are open; both 11 and 13 start from open.
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [12] },
				{ kind: 'options', figureIds: [11, 13] }
			]
		};
		expect(routinePlan([], shape, g, 3, seeded([0, 0])).map((s) => s.figureId)).toEqual([12, 11]);
		expect(routinePlan([], shape, g, 3, seeded([0, 0.99])).map((s) => s.figureId)).toEqual([
			12, 13
		]);
	});

	it('dances something anyway when no option fits — a break is not a stop', () => {
		// 11 ends closed; 14 needs hammerlock. The routine page warns; the run dances.
		expect(routinePlan([], opts(11, 14), g, 3, seeded([0])).map((s) => s.figureId)).toEqual([
			11, 14
		]);
	});

	it('flattens an embedded routine into the walk', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [11] },
				{ kind: 'child', routineId: 7, slots: [{ kind: 'options', figureIds: [12] }] }
			]
		};
		expect(routinePlan([], shape, g, 4, seeded([0])).map((s) => s.figureId)).toEqual([11, 12, 11]);
	});

	it('returns the plan untouched when nothing is danceable', () => {
		expect(routinePlan([], { slots: [] }, g, 8, seeded([0]))).toEqual([]);
		expect(
			routinePlan([], { slots: [{ kind: 'options', figureIds: [999] }] }, g, 8, seeded([0]))
		).toEqual([]);
	});

	it('is deterministic under a seeded rand', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [12] },
				{ kind: 'options', figureIds: [11, 13] }
			]
		};
		const a = routinePlan([], shape, g, 20, seeded([0.1, 0.9, 0.4]));
		const b = routinePlan([], shape, g, 20, seeded([0.1, 0.9, 0.4]));
		expect(a).toEqual(b);
		expect(a.length).toBeGreaterThan(5);
	});

	it('cannot run off the end of an option list when rand returns 1', () => {
		expect(routinePlan([], opts(11), g, 3, seeded([1])).map((s) => s.figureId)).toEqual([11, 11]);
	});
});

describe('routinePlan with a slot length', () => {
	it('spaces a free figure by the length its slot gives it', () => {
		const free: Graph = {
			positions: [],
			figures: [
				{ id: 40, starts: [], ends: [], start: 1, length: 8, free: true },
				{ id: 41, starts: [], ends: [], start: 1, length: 8 }
			]
		};
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [40], lengths: { 40: 12 } },
				{ kind: 'options', figureIds: [41] }
			]
		};
		const plan = routinePlan([], shape, free, LEAD_IN_8S + 2, seeded([0]));
		expect(plan.slice(0, 2)).toEqual([
			{ eight: LEAD_IN_8S, figureId: 40, slot: 0 },
			{ eight: LEAD_IN_8S + 2, figureId: 41, slot: 1 }
		]);
	});
});
