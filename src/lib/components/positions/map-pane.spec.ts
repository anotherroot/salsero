import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { MapNode } from '$lib/positions/map';
import type { MapData, MapTone } from '$lib/positions/map-view';
import MapPaneFixture from './fixtures/MapPaneFixture.svelte';
import MapTray from './MapTray.svelte';

/*
 * The full-screen map (spec 2026-11-08-map-walk, "At rest"): its source, and
 * MapPane and MapTray rendered on the server (`svelte/server`), as
 * pane-landmarks.spec.ts renders a list and its item.
 */
vi.mock('$app/state', () => ({
	page: {
		data: {},
		params: { dance: 'bachata' },
		route: { id: '/[dance]/(moves)/positions/map' },
		url: new URL('http://localhost/bachata/positions/map')
	}
}));

const read = (f: string) => readFileSync(f, 'utf8');
const code = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const PANE = 'src/lib/components/positions/MapPane.svelte';
const TRAY = 'src/lib/components/positions/MapTray.svelte';
const PAGE = 'src/routes/[dance]/(moves)/positions/map/+page.svelte';

const node = (id: number, mark: MapNode['mark'] = null, x = 100, y = 100): MapNode => ({
	id,
	x,
	y,
	w: 80,
	h: 32,
	lines: [`P${id}`],
	mark,
	markY: mark ? y + 25 : null,
	twins: false,
	twinsY: null
});

function data(o: {
	nodes?: MapNode[];
	positions?: number[];
	islands?: number[];
	noPosition?: number;
	inGroupMode?: boolean;
	edges?: { from: number; to: number }[];
}): MapData {
	const nodes = o.nodes ?? [];
	const ids = o.positions ?? [...nodes.map((n) => n.id), ...(o.islands ?? [])];
	return {
		empty: ids.length === 0,
		layout: {
			width: nodes.length ? 360 : 0,
			height: nodes.length ? 515 : 0,
			nodes,
			edges: (o.edges ?? []).map((e) => ({ ...e, width: 2 })),
			tray: { islands: o.islands ?? [], unused: [] }
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
		edges: (o.edges ?? []).map((e) => ({ ...e, width: 2, figures: 1, figs: [] })),
		anyFrom: [],
		noStart: [],
		noPosition: o.noPosition ?? 0,
		summary: 'S',
		types: [],
		mapLabel: 'The map of your positions',
		inGroupMode: o.inGroupMode ?? false
	};
}

const pane = (map: MapData) => render(MapPaneFixture, { props: { map } }).body;
const tray = (map: MapData) => render(MapTray, { props: { map, onpick: () => {} } }).body;

describe('MapPane', () => {
	it('draws the tray, not the Not on the map or islands cards', () => {
		const src = code(read(PANE));
		expect(src).toMatch(/<MapTray\b/);
		expect(src).not.toMatch(/\.notOnMap\b/);
		expect(src).not.toMatch(/map\.islands\b/);
	});

	it('a tray chip starts a fresh trail: never a step', () => {
		const src = code(read(PANE));
		expect(src).toContain('<MapTray {map} onpick={pickFresh} />');
		expect(src).toContain('pickFresh = (id: number) => (trail = { picked: id, back: [] })');
	});

	it('draws the map’s pills as links, the tray and its hint at rest', () => {
		const html = pane(
			data({ nodes: [node(1), node(2, 'orphan', 200, 300)], edges: [{ from: 1, to: 2 }] })
		);
		expect(html).toContain('role="group"');
		expect(html).toContain('href="/bachata/positions/1"');
		expect(html).toContain('href="/bachata/positions/2"');
		expect(html).toContain('Tap a position to see where it leads.');
		expect(html).not.toContain('Not on the map');
	});

	it('no positions: the empty text, the tray under it, no map', () => {
		const html = pane(data({ noPosition: 3 }));
		expect(html).toContain('No positions yet.');
		expect(html).toContain('3 with no position');
		expect(html).not.toContain('role="group"');
	});

	it('positions, but nothing joins them: the unjoined text, the tray, no map', () => {
		const html = pane(data({ positions: [5], islands: [5] }));
		expect(html).toContain('Nothing joins your positions yet');
		expect(html).toContain('href="/bachata/positions/5"');
		expect(html).not.toContain('role="group"');
	});
});

describe('MapTray', () => {
	const gaps = { nodes: [node(1, 'orphan'), node(2, 'dead end')], noPosition: 2 };

	it('shows the gap chips, and the rest', () => {
		const html = tray(data(gaps));
		expect(html).toContain('1 nothing gets to');
		expect(html).toContain('1 dead end');
		expect(html).toContain('2 with no position');
		expect(html).toContain('href="/bachata/positions/none"');
	});

	it('in group mode, no gap chips', () => {
		const html = tray(data({ ...gaps, inGroupMode: true }));
		// The exact chip words the test above finds.
		expect(html).not.toContain('1 nothing gets to');
		expect(html).not.toContain('1 dead end');
		expect(html).toContain('2 with no position');
	});

	it('draws from trayChips', () => {
		expect(code(read(TRAY))).toMatch(/trayChips\(/);
	});
});

describe('the map page', () => {
	it('draws no Screen: the title floats over the map', () => {
		const src = code(read(PAGE));
		expect(src).not.toMatch(/<Screen\b/);
		expect(src).toMatch(/<MapPane\b/);
	});

	it('is in NO_BAND with its reason', () => {
		expect(read('src/lib/nav/bands.spec.ts')).toContain(
			"'src/routes/[dance]/(moves)/positions/map/+page.svelte':"
		);
	});
});
