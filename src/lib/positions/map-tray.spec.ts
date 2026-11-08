import { describe, expect, it } from 'vitest';
import type { MapNode } from './map';
import type { MapData, MapTone } from './map-view';
import { trayChips } from './map-tray';

const node = (id: number, mark: MapNode['mark'] = null): MapNode => ({
	id,
	x: 0,
	y: 0,
	w: 60,
	h: 32,
	lines: [String(id)],
	mark,
	markY: mark ? 20 : null,
	twins: false,
	twinsY: null
});

function data(o: {
	nodes: MapNode[];
	islands?: number[];
	unused?: number[];
	noPosition?: number;
	inGroupMode?: boolean;
}): MapData {
	const ids = [...o.nodes.map((n) => n.id), ...(o.islands ?? []), ...(o.unused ?? [])];
	return {
		empty: ids.length === 0,
		layout: {
			width: 360,
			height: 515,
			nodes: o.nodes,
			edges: [],
			tray: { islands: o.islands ?? [], unused: o.unused ?? [] }
		},
		positions: ids.map((id) => ({
			id,
			name: `P${id}`,
			styleTag: null,
			tone: 'done' as MapTone,
			ins: 0,
			outs: 0,
			twinsLine: null,
			ariaLabel: `P${id}`
		})),
		edges: [],
		anyFrom: [],
		noStart: [],
		noPosition: o.noPosition ?? 0,
		summary: '',
		types: [],
		mapLabel: '',
		inGroupMode: o.inGroupMode ?? false
	};
}

describe('trayChips', () => {
	it('nothing to say: no chips', () => {
		expect(trayChips(data({ nodes: [node(1), node(2)] }))).toEqual([]);
	});

	it('orders the chips: nothing gets to, dead ends, unused, no position, then the islands', () => {
		const d = data({
			// Nodes come by name (the layout's order): the first such is the first in it.
			nodes: [node(4, 'dead end'), node(2, 'orphan'), node(7, 'orphan'), node(5, 'dead end')],
			islands: [9, 8],
			unused: [11, 10],
			noPosition: 6
		});
		expect(trayChips(d)).toEqual([
			{ kind: 'orphans', count: 2, pick: 2 },
			{ kind: 'deadEnds', count: 2, pick: 4 },
			{ kind: 'unused', count: 2, open: 11 },
			{ kind: 'noPosition', count: 6 },
			{ kind: 'island', id: 9, name: 'P9', tone: 'done' },
			{ kind: 'island', id: 8, name: 'P8', tone: 'done' }
		]);
	});

	it('in group mode: no gap chips, the rest as ever', () => {
		const d = data({
			nodes: [node(2, 'orphan'), node(4, 'dead end')],
			islands: [9],
			unused: [10],
			noPosition: 3,
			inGroupMode: true
		});
		const kinds = trayChips(d).map((c) => c.kind);
		expect(kinds).toEqual(['unused', 'noPosition', 'island']);
	});

	it('no positions at all: only the figures with no position', () => {
		expect(trayChips(data({ nodes: [], noPosition: 4 }))).toEqual([
			{ kind: 'noPosition', count: 4 }
		]);
	});
});
