import { describe, expect, it } from 'vitest';
import type { Graph } from '$lib/graph/graph';
import { LEAD_IN_8S, type PlanStep } from '$lib/scheduler/scheduler';
import { routinePlan } from './plan';
import type { RoutineShape } from './routines';

/** Same graph as routines.spec.ts: 1 open (neutral), 2 closed, 3 hammerlock. */
const g: Graph = {
	neutral: 1,
	figures: [
		{ id: 10, starts: [], end: null, eights: 1 },
		{ id: 11, starts: [1], end: 2, eights: 1 },
		{ id: 12, starts: [2], end: 1, eights: 1 },
		{ id: 13, starts: [1, 2], end: 3, eights: 2 },
		{ id: 14, starts: [3], end: 1, eights: 1 }
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
	it('calls the slots in order, starting after the lead-in', () => {
		const plan = routinePlan([], opts(11, 12), g, 1, 3, seeded([0]));
		expect(plan).toEqual([
			{ eight: LEAD_IN_8S, figureId: 11 },
			{ eight: LEAD_IN_8S + 1, figureId: 12 }
		]);
	});

	it('loops back to the first slot when the song outlasts the routine', () => {
		const plan = routinePlan([], opts(11, 12), g, 1, 6, seeded([0]));
		expect(plan.map((s) => s.figureId)).toEqual([11, 12, 11, 12, 11]);
	});

	it('spaces by max(every, eights)', () => {
		// 13 is 2 eights; callEvery is 1, so 13 gets 2 and 14 gets 1.
		const plan = routinePlan([], opts(13, 14), g, 1, 5, seeded([0]));
		expect(plan).toEqual([
			{ eight: 2, figureId: 13 },
			{ eight: 4, figureId: 14 },
			{ eight: 5, figureId: 13 }
		]);
	});

	it('lets a slower call rate win over a short figure', () => {
		const plan = routinePlan([], opts(11, 12), g, 4, 10, seeded([0]));
		expect(plan.map((s) => s.eight)).toEqual([2, 6, 10]);
	});

	it('resumes an existing plan without touching what it already decided', () => {
		const first = routinePlan([], opts(11, 12), g, 1, 3, seeded([0]));
		const second = routinePlan(first, opts(11, 12), g, 1, 5, seeded([0]));
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
		const given: PlanStep[] = [{ eight: 7, figureId: 14 }];
		const out = routinePlan(given, opts(11, 12), g, 1, 9, seeded([0]));
		expect(out[0]).toEqual({ eight: 7, figureId: 14 });
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
			expect(routinePlan([], shape, g, 1, 3, seeded([r])).map((s) => s.figureId)).toEqual([11, 12]);
		}
	});

	it('spreads across the options that fit, driven by rand', () => {
		// After 12 the hands are open; both 11 and 13 start from open.
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [12] },
				{ kind: 'options', figureIds: [11, 13] }
			]
		};
		expect(routinePlan([], shape, g, 1, 3, seeded([0, 0])).map((s) => s.figureId)).toEqual([
			12, 11
		]);
		expect(routinePlan([], shape, g, 1, 3, seeded([0, 0.99])).map((s) => s.figureId)).toEqual([
			12, 13
		]);
	});

	it('calls something anyway when no option fits — a break is not a stop', () => {
		// 11 ends closed; 14 needs hammerlock. The routine page warns; the run dances.
		expect(routinePlan([], opts(11, 14), g, 1, 3, seeded([0])).map((s) => s.figureId)).toEqual([
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
		expect(routinePlan([], shape, g, 1, 4, seeded([0])).map((s) => s.figureId)).toEqual([
			11, 12, 11
		]);
	});

	it('returns the plan untouched when nothing is danceable', () => {
		expect(routinePlan([], { slots: [] }, g, 1, 8, seeded([0]))).toEqual([]);
		expect(
			routinePlan([], { slots: [{ kind: 'options', figureIds: [999] }] }, g, 1, 8, seeded([0]))
		).toEqual([]);
	});

	it('is deterministic under a seeded rand', () => {
		const shape: RoutineShape = {
			slots: [
				{ kind: 'options', figureIds: [12] },
				{ kind: 'options', figureIds: [11, 13] }
			]
		};
		const a = routinePlan([], shape, g, 1, 20, seeded([0.1, 0.9, 0.4]));
		const b = routinePlan([], shape, g, 1, 20, seeded([0.1, 0.9, 0.4]));
		expect(a).toEqual(b);
		expect(a.length).toBeGreaterThan(5);
	});

	it('cannot run off the end of an option list when rand returns 1', () => {
		expect(routinePlan([], opts(11), g, 1, 3, seeded([1])).map((s) => s.figureId)).toEqual([
			11, 11
		]);
	});
});
