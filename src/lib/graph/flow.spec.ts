import { describe, expect, it } from 'vitest';
import { extendPlan } from '$lib/scheduler/scheduler';
import { graphFlow } from './flow';
import type { Graph } from './graph';

const OPEN = 10;
const CROSS = 11;
const HAMMER = 12;

const rand = (seq: number[]) => {
	let i = 0;
	return () => seq[i++ % seq.length];
};

const graph: Graph = {
	neutral: OPEN,
	figures: [
		{ id: 1, starts: [OPEN], end: CROSS, eights: 1 }, // open  → cross
		{ id: 2, starts: [CROSS], end: HAMMER, eights: 2 }, // cross → hammerlock, 2×8
		{ id: 3, starts: [HAMMER], end: OPEN, eights: 1 }, // hammer → open
		{ id: 4, starts: [OPEN], end: OPEN, eights: 1 } // open  → open
	]
};

describe('graphFlow', () => {
	it('only ever picks a figure that starts where the last one ended', () => {
		const flow = graphFlow(graph);
		// After figure 1 the hands are in cross-hand, where only figure 2 starts.
		expect(flow.pick([1, 2, 3, 4], 1, 0)).toBe(2);
		expect(flow.pick([1, 2, 3, 4], 2, 0)).toBe(3);
	});

	it('starts a run from the neutral position', () => {
		const flow = graphFlow(graph);
		// From open: figures 1 and 4. r = 0 takes the first.
		expect(flow.pick([1, 2, 3, 4], null, 0)).toBe(1);
		expect(flow.pick([1, 2, 3, 4], null, 0.99)).toBe(4);
	});

	it('only ever returns a figure from the pool', () => {
		const flow = graphFlow(graph);
		// Figure 2 is the only exit from cross-hand, but it is not on offer. The
		// walk resets to neutral rather than going silent — so the answer is one of
		// the pool's own, never the unoffered 2.
		expect([1, 4]).toContain(flow.pick([1, 3, 4], 1, 0));
	});

	it('returns null for an empty pool, and when the pool reaches nothing', () => {
		const flow = graphFlow(graph);
		expect(flow.pick([], null, 0)).toBeNull();
		// Figure 3 starts at hammerlock only, and the run begins at neutral. The
		// reset lands on neutral too, where 3 still does not start.
		expect(flow.pick([3], null, 0)).toBeNull();
	});

	it('resets to neutral out of a dead end rather than going silent', () => {
		// Nothing starts at HAMMER, so after figure 2 the walk is stuck.
		const stuck: Graph = { neutral: OPEN, figures: graph.figures.filter((f) => f.id !== 3) };
		const flow = graphFlow(stuck);
		expect(flow.pick([1, 2, 4], 2, 0)).toBe(1);
	});

	it('does not repeat a figure, unless it is the only way out', () => {
		const flow = graphFlow(graph);
		// From open there are two choices, so 4 does not repeat itself.
		expect(flow.pick([1, 4], 4, 0.99)).toBe(1);
		// Pool of one: repeating beats falling silent.
		expect(flow.pick([4], 4, 0)).toBe(4);
	});

	it('reports each figure’s length, defaulting to 1 for an unknown id', () => {
		const flow = graphFlow(graph);
		expect(flow.eights(2)).toBe(2);
		expect(flow.eights(99)).toBe(1);
	});

	it('walks a neutral-only graph exactly as the uniform flow does', () => {
		// THE property that lets this ship without a data backfill: until figures
		// are tagged, the graph is one neutral hub and the walk must be
		// indistinguishable from the drill the player has always run. It compares
		// whole plans, so a divergence in WHICH figure or in what ORDER the
		// candidates were offered both fail it.
		//
		// The pool is deliberately NOT in id order (`[3, 1, 2]`, not `[1, 2, 3]`):
		// with an ascending pool, filtering by the graph's declared figure order
		// and filtering by the pool's own order produce the same sequence by
		// coincidence, and a pool-vs-graph reordering bug would slip through
		// undetected. A shuffled pool is what actually exercises "the order is the
		// pool's" — verified by temporarily reversing the filter in `flow.ts` and
		// confirming this test fails.
		const flat: Graph = {
			neutral: OPEN,
			figures: [1, 2, 3].map((id) => ({ id, starts: [], end: null, eights: 1 }))
		};
		const viaGraph = extendPlan([], [3, 1, 2], 2, 10, rand([0, 0.5, 0.9]), graphFlow(flat));
		const viaUniform = extendPlan([], [3, 1, 2], 2, 10, rand([0, 0.5, 0.9]));
		expect(viaGraph).toEqual(viaUniform);
	});

	it('produces a dancable plan through extendPlan', () => {
		const steps = extendPlan([], [1, 2, 3, 4], 1, 8, rand([0]), graphFlow(graph));
		const by = (id: number) => graph.figures.find((f) => f.id === id)!;
		expect(steps.length).toBeGreaterThan(2);
		// Every consecutive pair connects: the previous figure's end is one of the
		// next figure's start positions. That is the whole point of the walk.
		for (let i = 1; i < steps.length; i++) {
			expect(by(steps[i].figureId).starts).toContain(by(steps[i - 1].figureId).end);
		}
	});
});
