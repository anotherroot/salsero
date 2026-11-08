import { describe, expect, it } from 'vitest';
import type { Graph, GraphFigure } from '$lib/graph/graph';
import { positionCounts } from '$lib/graph/graph';
import { withLocale } from '$lib/i18n/current';
import { t } from '$lib/i18n/catalog';
import {
	edgeWidth,
	LINE_HEIGHT,
	layoutMap,
	markBox,
	MARK_CHAR,
	MAX_PASSES,
	mapInputOf,
	mapLabel,
	mapSize,
	pillLines,
	pillSize,
	twinsBox,
	type MapInput,
	type MapLayout,
	type MapNode,
	type MapStats
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

/**
 * The mockup's bigger library (`big/data1.part`): 20 positions, 88 figures.
 * Each position with the figures through it; each edge with the figures from
 * its start to its end (a figure with two starts counts on both edges).
 */
const MOCKUP_POSITIONS: [string, number][] = [
	['Lasso', 3],
	['Open, one hand', 16],
	['Back to back', 2],
	['Side by side', 4],
	['Cross-hand', 7],
	['Corner step end', 3],
	['Butterfly', 2],
	['Open, two hands', 45],
	['Sombrero', 5],
	['Hammerlock', 5],
	['Special late turn side', 5],
	['Reverse hammerlock', 4],
	['Shadow Open', 9],
	['Cradle', 11],
	['Sweetheart', 6],
	['Shadow Closed', 6],
	['Closed', 28],
	['Titanic', 2],
	['Hip hold', 4],
	['Dip', 6]
];
// prettier-ignore
const MOCKUP_EDGES: [number, number, number][] = [
	[1, 2, 1], [1, 13, 1], [2, 1, 1], [2, 8, 6], [2, 11, 2], [2, 17, 2], [3, 2, 1], [3, 8, 1],
	[4, 4, 1], [4, 8, 1], [4, 13, 1], [5, 8, 1], [5, 9, 1], [5, 12, 1], [5, 17, 1], [6, 5, 1],
	[6, 6, 1], [6, 8, 1], [7, 8, 1], [8, 2, 2], [8, 4, 1], [8, 5, 2], [8, 6, 1], [8, 7, 1],
	[8, 8, 11], [8, 9, 1], [8, 10, 2], [8, 11, 2], [8, 12, 1], [8, 13, 2], [8, 14, 3], [8, 15, 1],
	[8, 17, 3], [9, 8, 1], [9, 14, 1], [9, 17, 1], [10, 8, 1], [10, 12, 1], [10, 17, 1],
	[11, 8, 1], [11, 17, 1], [12, 8, 1], [12, 15, 1], [13, 2, 1], [13, 17, 2], [14, 8, 1],
	[14, 11, 1], [14, 14, 1], [14, 16, 1], [14, 17, 2], [15, 8, 1], [15, 15, 1], [15, 16, 1],
	[15, 18, 1], [16, 13, 1], [16, 16, 1], [16, 19, 1], [17, 8, 3], [17, 14, 1], [17, 15, 1],
	[17, 16, 1], [17, 17, 6], [17, 19, 1], [17, 20, 3], [18, 13, 1], [19, 17, 1], [19, 20, 1],
	[20, 8, 1], [20, 17, 1]
];
function mockup(): MapInput {
	return {
		positions: MOCKUP_POSITIONS.map(([name, figures], i) => pos(i + 1, name, figures)),
		edges: MOCKUP_EDGES.map(([from, to, figures]) => edge(from, to, figures))
	};
}

function shuffled<T>(xs: T[]): T[] {
	// a fixed permutation: reverse, then rotate by 3
	const r = [...xs].reverse();
	return [...r.slice(3), ...r.slice(0, 3)];
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const boxesOverlap = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const pillBox = (n: MapNode): Box => ({
	x0: n.x - n.w / 2,
	y0: n.y - n.h / 2,
	x1: n.x + n.w / 2,
	y1: n.y + n.h / 2
});

/** A node's parts: its pill, then a dead end's or orphan's word, then Twins. */
function partsOf(n: MapNode): Box[] {
	const parts = [pillBox(n)];
	if (n.mark === null) expect(n.markY).toBe(null);
	else parts.push(markBox(n.mark, n.x, n.markY!));
	if (!n.twins) expect(n.twinsY).toBe(null);
	else parts.push(twinsBox(n.x, n.twinsY!));
	return parts;
}

/** A node's outline: the box round its pill and the lines under it. */
function outlineOf(n: MapNode): Box {
	const parts = partsOf(n);
	return {
		x0: Math.min(...parts.map((p) => p.x0)),
		y0: Math.min(...parts.map((p) => p.y0)),
		x1: Math.max(...parts.map((p) => p.x1)),
		y1: Math.max(...parts.map((p) => p.y1))
	};
}

function expectClean(input: MapInput, out: MapLayout) {
	for (const n of out.nodes) {
		// The pill is sized from its name, cut at LABEL_MAX and split as pillLines does.
		const name = input.positions.find((p) => p.id === n.id)!.name;
		expect(n.lines).toEqual(pillLines(mapLabel(name)));
		expect({ w: n.w, h: n.h }).toEqual(pillSize(n.lines));
		// The lines sit under the pill, each under the last.
		const parts = partsOf(n);
		for (let k = 1; k < parts.length; k++)
			expect(parts[k].y0).toBeGreaterThanOrEqual(parts[k - 1].y1);
	}
	const outlines = out.nodes.map(outlineOf);
	for (let i = 0; i < outlines.length; i++) {
		const a = outlines[i];
		// inside the frame, lines included
		expect(a.x0).toBeGreaterThanOrEqual(0);
		expect(a.y0).toBeGreaterThanOrEqual(0);
		expect(a.x1).toBeLessThanOrEqual(out.width);
		expect(a.y1).toBeLessThanOrEqual(out.height);
		for (let j = i + 1; j < outlines.length; j++) expect(boxesOverlap(a, outlines[j])).toBe(false);
	}
}

describe('sizes', () => {
	it('splits a name longer than 16 characters into two balanced lines, at a space', () => {
		expect(pillLines('Special late turn side')).toEqual(['Special late', 'turn side']);
		expect(pillLines('Cradle')).toEqual(['Cradle']);
		// 16 characters stay on one line, 17 do not
		expect(pillLines('Open, two hands!')).toEqual(['Open, two hands!']);
		expect(pillLines('Open, two hands!!')).toEqual(['Open, two', 'hands!!']);
		// no space: one line, however long
		expect(pillLines('Supercalifragilistic')).toEqual(['Supercalifragilistic']);
		expect(pillLines('Crossed hands, right on top')).toEqual(['Crossed hands,', 'right on top']);
	});
	it('sizes a pill from its widest line: 7.6 px a character and 40, 32 high or 46 for two', () => {
		expect(pillSize(['Cradle'])).toEqual({ w: 85.6, h: 32 });
		expect(pillSize(['Special late', 'turn side'])).toEqual({ w: 131.2, h: 46 });
	});
	it('widens an edge with its figures, capped at 6', () => {
		expect(edgeWidth(1)).toBe(2);
		expect(edgeWidth(3)).toBe(4);
		expect(edgeWidth(5)).toBe(6);
		expect(edgeWidth(40)).toBe(6);
	});
	it('picks a portrait frame from the node count, never under 360 across', () => {
		expect(mapSize(0)).toEqual({ width: 0, height: 0 });
		expect(mapSize(1)).toEqual({ width: 360, height: 515 });
		// about the mockup's 600 × 860 for its 20 positions
		expect(mapSize(20)).toEqual({ width: 599, height: 856 });
		expect(mapSize(64)).toEqual({ width: 1071, height: 1530 });
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

	it('keeps 15 positions apart: no pill, line or frame overlap', () => {
		const input = fifteen();
		const out = layoutMap(input);
		expect(out.width).toBe(mapSize(15).width);
		expect(out.height).toBe(mapSize(15).height);
		expectClean(input, out);
	});

	it("keeps the mockup's 20 positions apart, and the pushing settles", () => {
		const input = mockup();
		let stats: MapStats | null = null;
		const out = layoutMap(input, { onStats: (s) => (stats = s) });
		expect(out.nodes).toHaveLength(20);
		expect(out.nodes.find((n) => n.id === 11)!.lines).toEqual(['Special late', 'turn side']);
		expect(out.nodes.find((n) => n.id === 3)!.mark).toBe('orphan');
		expectClean(input, out);
		expect(stats).toEqual({ passes: expect.any(Number), settled: true });
		expect(stats!.passes).toBeLessThan(MAX_PASSES / 3);
		expectClean(input, layoutMap(input, { steps: 0 }));
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

	it('sizes pills from their names and edges from their figures, and keeps a self-loop', () => {
		const out = layoutMap({
			positions: [pos(1, 'Cradle', 4), pos(2, 'Special late turn side', 100)],
			edges: [edge(1, 2, 3), edge(2, 1, 9), edge(2, 2, 1)]
		});
		// The figures through a position do not size its pill: its name does.
		expect(out.nodes.map((n) => [n.id, n.lines, n.w, n.h])).toEqual([
			[1, ['Cradle'], 85.6, 32],
			[2, ['Special late', 'turn side'], 131.2, 46]
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

	it('gives a dead end or orphan room for its word under its name', () => {
		// A hub that leads into twelve dead ends and is reached from twelve orphans:
		// short names, so the word is wider than the name, and the marked ones crowd the edges.
		const positions = [pos(1, 'Hub', 24)];
		const edges = [];
		for (let i = 2; i <= 13; i++) {
			positions.push(pos(i, `D${i}`));
			edges.push(edge(1, i));
		}
		for (let i = 14; i <= 25; i++) {
			positions.push(pos(i, `O${i}`));
			edges.push(edge(i, 1));
		}
		const input = { positions, edges };
		const out = layoutMap(input);
		const marked = out.nodes.filter((n) => n.mark !== null);
		expect(marked).toHaveLength(24);
		const d = out.nodes.find((n) => n.id === 2)!;
		expect(d.mark).toBe('dead end');
		// The word's line sits right under the pill: 2 px down, a line 14 px high.
		expect(d.markY).toBeCloseTo(d.y + d.h / 2 + 2 + LINE_HEIGHT / 2, 5);
		// Wider than a two-letter pill: the outline is the word's.
		const word = markBox('dead end', 0, 0);
		expect(word.x1 - word.x0).toBeGreaterThan(d.w);
		expect(outlineOf(d).x1 - outlineOf(d).x0).toBeCloseTo(word.x1 - word.x0, 5);
		expectClean(input, out);
		expectClean(input, layoutMap(input, { steps: 0 }));
	});

	it('gives a twinned position room for its Twins line, under the mark when it has one', () => {
		// The same crowd, every other one twinned, and the hub too.
		const positions = [{ ...pos(1, 'Hub', 24), twins: true }];
		const edges = [];
		for (let i = 2; i <= 13; i++) {
			positions.push({ ...pos(i, `D${i}`), twins: i % 2 === 0 });
			edges.push(edge(1, i));
		}
		for (let i = 14; i <= 25; i++) {
			positions.push({ ...pos(i, `O${i}`), twins: i % 2 === 0 });
			edges.push(edge(i, 1));
		}
		const input = { positions, edges };
		const out = layoutMap(input);
		const hub = out.nodes.find((n) => n.id === 1)!;
		// No mark: the Twins line is the second.
		expect(hub).toMatchObject({ mark: null, markY: null, twins: true });
		expect(hub.twinsY).toBeCloseTo(hub.y + hub.h / 2 + 2 + LINE_HEIGHT / 2, 5);
		// A dead end: the pill, the mark, then Twins.
		const d = out.nodes.find((n) => n.id === 2)!;
		expect(d).toMatchObject({ mark: 'dead end', twins: true });
		expect(d.twinsY).toBeCloseTo(d.markY! + 2 + LINE_HEIGHT, 5);
		expect(out.nodes.find((n) => n.id === 3)!.twinsY).toBe(null);
		// The outline reaches past both lines under the pill.
		expect(outlineOf(d).y1 - (d.y + d.h / 2)).toBeCloseTo(2 * (2 + LINE_HEIGHT), 5);
		expect(twinsBox(0, 0).y1 - twinsBox(0, 0).y0).toBe(LINE_HEIGHT);
		expectClean(input, out);
		expectClean(input, layoutMap(input, { steps: 0 }));
		expectClean(input, layoutMap(input, { steps: 40 }));
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
		expect(out.nodes.map((n) => [n.id, n.twins, n.twinsY === null])).toEqual([
			[1, true, false],
			[2, false, true]
		]);
	});

	it('settles 60 positions in few passes, inside the frame and apart', () => {
		const positions = Array.from({ length: 60 }, (_, i) =>
			pos(i + 1, `Position number ${i + 1}`, 1 + (i % 9))
		);
		const edges = [];
		for (let i = 1; i <= 60; i++) {
			edges.push(edge(i, (i % 60) + 1, 1 + (i % 3)));
			edges.push(edge(i, ((i * 7) % 60) + 1, 1));
		}
		const input = { positions, edges };
		let stats: MapStats | null = null;
		const out = layoutMap(input, { onStats: (s) => (stats = s) });
		expect(out.nodes).toHaveLength(60);
		expectClean(input, out);
		// The work is counted, not timed: the pushing settles well under the cap.
		expect(stats).toEqual({ passes: expect.any(Number), settled: true });
		expect(stats!.passes).toBeLessThan(MAX_PASSES / 3);
	});

	it('says when the pushing settled, and how many passes it took', () => {
		const seen: MapStats[] = [];
		layoutMap(fifteen(), { onStats: (s) => seen.push(s) });
		expect(seen).toHaveLength(1);
		expect(seen[0].settled).toBe(true);
		expect(seen[0].passes).toBeGreaterThanOrEqual(1);
		expect(seen[0].passes).toBeLessThan(MAX_PASSES);
	});

	it('keeps a crowd of wide pills round a hub apart', () => {
		// 40 positions with long one-line names, every one joined to a hub, and a ring
		const positions = Array.from({ length: 40 }, (_, i) =>
			pos(i + 1, `Big_position_number_${i + 1}`, 100)
		);
		positions.push(pos(41, 'Hub', 400));
		const edges = [];
		for (let i = 1; i <= 40; i++) {
			edges.push(edge(41, i, 6), edge(i, 41, 6), edge(i, (i % 40) + 1, 3));
		}
		const input = { positions, edges };
		let stats: MapStats | null = null;
		const out = layoutMap(input, { onStats: (s) => (stats = s) });
		expect(out.nodes).toHaveLength(41);
		expect(out.nodes.filter((n) => n.lines.length === 1 && n.w > 180)).toHaveLength(40);
		expect(stats!.settled).toBe(true);
		expectClean(input, out);
	});

	it('cuts a long name at 40 characters, so its pill still fits the frame', () => {
		const long = 'A very long position name of sixty characters, really long!!';
		expect([...long]).toHaveLength(60);
		expect(mapLabel(long)).toBe(long.slice(0, 39) + '…');
		expect([...mapLabel(long)]).toHaveLength(40);
		expect(mapLabel('Cuddle')).toBe('Cuddle');
		// No space to split at: one line of 40 characters, the widest pill there is.
		const word = 'x'.repeat(60);
		expect(pillSize(pillLines(mapLabel(word))).w).toBe(344);

		const input = {
			positions: [pos(1, long, 3), pos(2, 'Cuddle', 3), pos(3, long + ' too', 1), pos(4, word, 1)],
			edges: [edge(1, 2, 2), edge(2, 3, 1), edge(3, 4, 1), edge(4, 1, 1)]
		};
		const out = layoutMap(input);
		expect(out.width).toBe(360);
		expect(out.nodes.find((n) => n.id === 1)!.lines).toHaveLength(2);
		expectClean(input, out);
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
				{ id: 1, name: 'Closed', styleTag: 'la', twins: false },
				{ id: 2, name: 'Open', styleTag: null, twins: true },
				{ id: 3, name: 'Unused', styleTag: null, twins: false }
			],
			figures: [fig(10, [1], [2]), fig(11, [1, 2], [2]), fig(12, [2], []), fig(13, [], [])]
		};
		// A node stands for twins when the graph's position does (ruling 16).
		expect(mapInputOf(g)).toEqual({
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
			positions: [1, 2, 3, 4, 5].map((id) => ({
				id,
				name: `p${id}`,
				styleTag: null,
				twins: false
			})),
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

describe('the words under a pill have room in every language', () => {
	const width = (b: { x0: number; x1: number }) => b.x1 - b.x0;
	it.each(['en', 'sl'] as const)('%s: the mark words and Twins fit their boxes', (locale) => {
		withLocale(locale, () => {
			const m = t().map;
			expect(width(markBox('dead end', 0, 0))).toBeGreaterThanOrEqual(
				[...m.mark.deadEnd].length * MARK_CHAR
			);
			expect(width(markBox('orphan', 0, 0))).toBeGreaterThanOrEqual(
				[...m.mark.orphan].length * MARK_CHAR
			);
			expect(width(twinsBox(0, 0))).toBeGreaterThanOrEqual([...m.twins].length * MARK_CHAR);
		});
	});
});
