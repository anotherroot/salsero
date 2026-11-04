import { describe, expect, it } from 'vitest';
import type { Graph, GraphFigure } from '$lib/graph/graph';
import { positionCounts } from '$lib/graph/graph';
import {
	edgeWidth,
	labelBox,
	layoutMap,
	mapInputOf,
	mapSize,
	nodeRadius,
	type MapInput,
	type MapLayout,
	type MapNode
} from './map';

const pos = (id: number, name: string, figures = 1, styleTag: string | null = null) => ({
	id,
	name,
	styleTag,
	figures
});
const edge = (from: number, to: number, figures = 1) => ({ from, to, figures });

/** A 15-position repertoire: one main part, with real (long) names. */
const NAMES = [
	'Closed position',
	'Open right to right',
	'Cross body lead',
	'Hammerlock',
	'Cuddle',
	'Shadow position',
	'Crossed hands, right on top',
	'Sombrero',
	'Titanic',
	'Behind the back',
	'Open left to right',
	'Neck wrap',
	'Back to back',
	'Copa finish',
	'Setenta hold'
];
function fifteen(): MapInput {
	const positions = NAMES.map((n, i) => pos(i + 1, n, 1 + (i % 7), i % 3 === 0 ? 'cuban' : null));
	const edges = [];
	// a ring through all fifteen, plus chords: one connected main part
	for (let i = 1; i <= 15; i++) edges.push(edge(i, (i % 15) + 1, 1 + (i % 4)));
	edges.push(edge(1, 5, 3), edge(2, 9, 2), edge(4, 12, 1), edge(7, 13, 5), edge(10, 3, 2));
	edges.push(edge(6, 6, 2)); // a figure that starts and ends in the same hold
	return { positions, edges };
}

function shuffled<T>(xs: T[]): T[] {
	// a fixed permutation: reverse, then rotate by 3
	const r = [...xs].reverse();
	return [...r.slice(3), ...r.slice(0, 3)];
}

function nameOf(input: MapInput, id: number): string {
	return input.positions.find((p) => p.id === id)!.name;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const boxesOverlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
function circleHitsBox(n: MapNode, b: Box): boolean {
	const cx = Math.max(b.x0, Math.min(n.x, b.x1));
	const cy = Math.max(b.y0, Math.min(n.y, b.y1));
	return Math.hypot(n.x - cx, n.y - cy) < n.r;
}

function expectClean(input: MapInput, out: MapLayout) {
	const boxes = out.nodes.map((n) => labelBox(nameOf(input, n.id), n.labelX, n.labelY));
	for (let i = 0; i < out.nodes.length; i++) {
		const a = out.nodes[i];
		// inside the frame, label included
		expect(a.x - a.r).toBeGreaterThanOrEqual(0);
		expect(a.y - a.r).toBeGreaterThanOrEqual(0);
		expect(a.x + a.r).toBeLessThanOrEqual(out.width);
		expect(a.y + a.r).toBeLessThanOrEqual(out.height);
		expect(boxes[i].x0).toBeGreaterThanOrEqual(0);
		expect(boxes[i].y0).toBeGreaterThanOrEqual(0);
		expect(boxes[i].x1).toBeLessThanOrEqual(out.width);
		expect(boxes[i].y1).toBeLessThanOrEqual(out.height);
		for (let j = 0; j < out.nodes.length; j++) {
			if (i === j) continue;
			const b = out.nodes[j];
			if (j > i) {
				expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r);
				expect(boxesOverlap(boxes[i], boxes[j])).toBe(false);
			}
			expect(circleHitsBox(a, boxes[j])).toBe(false);
		}
	}
}

describe('sizes', () => {
	it('grows a circle with the figures through it, capped at 34', () => {
		expect(nodeRadius(0)).toBe(14);
		expect(nodeRadius(4)).toBe(22);
		expect(nodeRadius(25)).toBe(34);
		expect(nodeRadius(400)).toBe(34);
	});
	it('widens an edge with its figures, capped at 6', () => {
		expect(edgeWidth(1)).toBe(2);
		expect(edgeWidth(3)).toBe(4);
		expect(edgeWidth(5)).toBe(6);
		expect(edgeWidth(40)).toBe(6);
	});
	it('estimates a label at 7 px a character by 14 px, centred on its point', () => {
		expect(labelBox('Cuddle', 100, 50)).toEqual({ x0: 79, y0: 43, x1: 121, y1: 57 });
	});
	it('picks a square frame from the node count, never under 360', () => {
		expect(mapSize(0)).toEqual({ width: 0, height: 0 });
		expect(mapSize(1)).toEqual({ width: 360, height: 360 });
		expect(mapSize(16)).toEqual({ width: 560, height: 560 });
		expect(mapSize(64)).toEqual({ width: 1120, height: 1120 });
	});
});

describe('layoutMap', () => {
	it('gives an empty layout for an empty input', () => {
		expect(layoutMap({ positions: [], edges: [] })).toEqual({
			width: 0,
			height: 0,
			nodes: [],
			edges: [],
			tray: { islands: [], unused: [] }
		});
	});

	it('gives the same layout for the same input, twice', () => {
		const a = layoutMap(fifteen());
		const b = layoutMap(fifteen());
		expect(a.nodes).toHaveLength(15);
		expect(b).toEqual(a);
	});

	it('does not care what order the positions and edges come in', () => {
		const input = fifteen();
		const turned = { positions: shuffled(input.positions), edges: shuffled(input.edges) };
		expect(layoutMap(turned)).toEqual(layoutMap(input));
	});

	it('lists nodes by folded name, then id', () => {
		const out = layoutMap({
			positions: [pos(3, 'Ábaco'), pos(1, 'zeta'), pos(2, 'abaco')],
			edges: [edge(1, 2), edge(2, 3), edge(3, 1)]
		});
		expect(out.nodes.map((n) => n.id)).toEqual([2, 3, 1]);
	});

	it('keeps 15 positions apart: no circle, label or frame overlap', () => {
		const input = fifteen();
		const out = layoutMap(input);
		expect(out.width).toBe(mapSize(15).width);
		expect(out.height).toBe(mapSize(15).height);
		expectClean(input, out);
	});

	it('keeps them apart even before the force steps have done anything', () => {
		const input = fifteen();
		expectClean(input, layoutMap(input, { steps: 0 }));
	});

	it('lays a chain out with the middle between the ends', () => {
		// The middle one is first by name, so the start circle does not put it there.
		const input = {
			positions: [pos(1, 'Alpha'), pos(2, 'Beta'), pos(3, 'Gamma')],
			edges: [edge(2, 1, 2), edge(1, 3, 2)]
		};
		const out = layoutMap(input);
		const at = (id: number) => out.nodes.find((n) => n.id === id)!;
		// ends Beta (2) and Gamma (3), the middle Alpha (1)
		const [m, b, c] = [at(1), at(2), at(3)];
		const ends = Math.hypot(b.x - c.x, b.y - c.y);
		expect(Math.hypot(m.x - b.x, m.y - b.y)).toBeLessThan(ends);
		expect(Math.hypot(m.x - c.x, m.y - c.y)).toBeLessThan(ends);
		// …and it lies between them along the line from end to end
		const t = ((m.x - b.x) * (c.x - b.x) + (m.y - b.y) * (c.y - b.y)) / ends ** 2;
		expect(t).toBeGreaterThan(0.2);
		expect(t).toBeLessThan(0.8);
	});

	it('sizes circles and edges, and keeps a self-loop', () => {
		const out = layoutMap({
			positions: [pos(1, 'A', 4), pos(2, 'B', 100)],
			edges: [edge(1, 2, 3), edge(2, 1, 9), edge(2, 2, 1)]
		});
		expect(out.nodes.map((n) => [n.id, n.r])).toEqual([
			[1, 22],
			[2, 34]
		]);
		expect(out.edges).toEqual([
			{ from: 1, to: 2, width: 4 },
			{ from: 2, to: 1, width: 6 },
			{ from: 2, to: 2, width: 2 }
		]);
	});

	it('merges two edges between the same pair', () => {
		const out = layoutMap({
			positions: [pos(1, 'A'), pos(2, 'B')],
			edges: [edge(1, 2, 1), edge(1, 2, 2)]
		});
		expect(out.edges).toEqual([{ from: 1, to: 2, width: 4 }]);
	});

	it('marks dead ends and orphans from the edges', () => {
		// 1 → 2 → 3, and 3 leads nowhere: 1 is an orphan, 3 a dead end
		const out = layoutMap({
			positions: [pos(1, 'One'), pos(2, 'Two', 2), pos(3, 'Three')],
			edges: [edge(1, 2), edge(2, 3)]
		});
		const mark = Object.fromEntries(out.nodes.map((n) => [n.id, n.mark]));
		expect(mark).toEqual({ 1: 'orphan', 2: null, 3: 'dead end' });
	});

	it('puts islands and unused positions in the tray, by name, and draws only the main part', () => {
		const out = layoutMap({
			positions: [
				pos(1, 'Main a', 3),
				pos(2, 'Main b', 3),
				pos(3, 'Main c', 2),
				pos(4, 'Zulu island', 1),
				pos(5, 'Island b', 1),
				pos(6, 'Nothing yet', 0),
				pos(7, 'Also nothing', 0)
			],
			edges: [edge(1, 2, 2), edge(2, 3, 2), edge(3, 1, 1), edge(4, 5, 1), edge(1, 4, 0)]
		});
		expect(out.nodes.map((n) => n.id).sort()).toEqual([1, 2, 3]);
		expect(out.tray).toEqual({ islands: [5, 4], unused: [7, 6] });
		// no edge to or from a position in the tray
		expect(out.edges.every((e) => [1, 2, 3].includes(e.from) && [1, 2, 3].includes(e.to))).toBe(
			true
		);
	});

	it('picks the main part by figures, then positions, then the lowest id', () => {
		// part {1,2}: 2 figures; part {3,4,5}: 2 figures over more positions → main
		const more = layoutMap({
			positions: [pos(1, 'a'), pos(2, 'b'), pos(3, 'c'), pos(4, 'd'), pos(5, 'e')],
			edges: [edge(1, 2, 2), edge(3, 4, 1), edge(4, 5, 1)]
		});
		expect(more.nodes.map((n) => n.id)).toEqual([3, 4, 5]);
		expect(more.tray.islands).toEqual([1, 2]);
		// two parts alike in every way: the one with the lowest id wins
		const tie = layoutMap({
			positions: [pos(9, 'a'), pos(2, 'b'), pos(3, 'c'), pos(8, 'd')],
			edges: [edge(9, 8, 1), edge(2, 3, 1)]
		});
		expect(tie.nodes.map((n) => n.id)).toEqual([2, 3]);
		expect(tie.tray.islands).toEqual([9, 8]);
	});

	it('never calls a part of one position an island: it is drawn', () => {
		// 4 only loops on itself: cut off, but alone, so on the map
		const out = layoutMap({
			positions: [pos(1, 'a', 2), pos(2, 'b', 2), pos(4, 'loop', 1)],
			edges: [edge(1, 2, 2), edge(4, 4, 1)]
		});
		expect(out.nodes.map((n) => n.id)).toEqual([1, 2, 4]);
		expect(out.tray.islands).toEqual([]);
		expectClean({ positions: [pos(1, 'a', 2), pos(2, 'b', 2), pos(4, 'loop', 1)], edges: [] }, out);
	});

	it('trusts the gap report when the input carries it', () => {
		const out = layoutMap({
			positions: [
				{ ...pos(1, 'a', 2), gaps: { deadEnd: false, orphan: true, island: false } },
				{ ...pos(2, 'b', 2), gaps: { deadEnd: false, orphan: false, island: true } }
			],
			edges: [edge(1, 2, 2)]
		});
		expect(out.nodes.map((n) => [n.id, n.mark])).toEqual([[1, 'orphan']]);
		expect(out.tray.islands).toEqual([2]);
	});

	it('carries twins, false by default', () => {
		const out = layoutMap({
			positions: [{ ...pos(1, 'a'), twins: true }, pos(2, 'b')],
			edges: [edge(1, 2)]
		});
		expect(out.nodes.map((n) => [n.id, n.twins])).toEqual([
			[1, true],
			[2, false]
		]);
	});

	it('lays out 60 positions quickly, inside the frame and apart', () => {
		const positions = Array.from({ length: 60 }, (_, i) =>
			pos(i + 1, `Position number ${i + 1}`, 1 + (i % 9))
		);
		const edges = [];
		for (let i = 1; i <= 60; i++) {
			edges.push(edge(i, (i % 60) + 1, 1 + (i % 3)));
			edges.push(edge(i, ((i * 7) % 60) + 1, 1));
		}
		const input = { positions, edges };
		const out = layoutMap(input);
		expect(out.nodes).toHaveLength(60);
		expectClean(input, out);
		// the best of three, so a busy machine's one stall does not decide it
		const times = [0, 1, 2].map(() => {
			const t0 = performance.now();
			layoutMap(input);
			return performance.now() - t0;
		});
		expect(Math.min(...times)).toBeLessThan(50);
	});
});

describe('mapInputOf', () => {
	const fig = (id: number, starts: number[], ends: number[]): GraphFigure => ({
		id,
		starts,
		ends,
		start: 1,
		length: 8
	});

	it('counts figures through each position and between each pair, from the graph', () => {
		const g: Graph = {
			positions: [
				{ id: 1, name: 'Closed', styleTag: 'la' },
				{ id: 2, name: 'Open', styleTag: null },
				{ id: 3, name: 'Unused', styleTag: null }
			],
			figures: [fig(10, [1], [2]), fig(11, [1, 2], [2]), fig(12, [2], []), fig(13, [], [])]
		};
		expect(mapInputOf(g, new Set([2]))).toEqual({
			positions: [
				{
					id: 1,
					name: 'Closed',
					styleTag: 'la',
					figures: 2,
					twins: false,
					gaps: { deadEnd: false, orphan: true, island: false }
				},
				{
					id: 2,
					name: 'Open',
					styleTag: null,
					figures: 3,
					twins: true,
					gaps: { deadEnd: false, orphan: false, island: false }
				},
				{
					id: 3,
					name: 'Unused',
					styleTag: null,
					figures: 0,
					twins: false,
					gaps: { deadEnd: false, orphan: false, island: false }
				}
			],
			edges: [
				{ from: 1, to: 2, figures: 2 },
				{ from: 2, to: 2, figures: 1 }
			]
		});
	});

	it('sends to the tray exactly what the gap report calls an island', () => {
		// figure 20 joins 1,2,3 through multi-tag sides; edges alone would
		// over-count it. The main part must still be the gap report's.
		const g: Graph = {
			positions: [1, 2, 3, 4, 5].map((id) => ({ id, name: `p${id}`, styleTag: null })),
			figures: [fig(20, [1, 2], [3]), fig(21, [4], [5]), fig(22, [5], [4])]
		};
		const islands = positionCounts(g, [1, 2, 3, 4, 5])
			.filter((c) => c.island)
			.map((c) => c.id);
		expect(islands).toEqual([1, 2, 3]);
		const out = layoutMap(mapInputOf(g));
		expect(out.tray.islands).toEqual(islands);
		expect(out.nodes.map((n) => n.id)).toEqual([4, 5]);
	});
});
