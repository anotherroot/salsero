import { readFileSync } from 'node:fs';
import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import type { MapNode } from '$lib/positions/map';
import type { MapData, MapTone } from '$lib/positions/map-view';
import MapPaneFixture from './fixtures/MapPaneFixture.svelte';
import MapTray from './MapTray.svelte';
import MapSheet from './MapSheet.svelte';
import type { PositionSheet } from '$lib/positions/map-sheet';

/*
 * The full-screen map (spec 2026-11-08-map-walk, "At rest"): its source, and
 * MapPane and MapTray rendered on the server (`svelte/server`), as
 * pane-landmarks.spec.ts renders a list and its item.
 */
// The page's URL, set per test (`?pick=`).
const at = vi.hoisted(() => ({ url: new URL('http://localhost/bachata/positions/map') }));
vi.mock('$app/state', () => ({
	page: {
		data: {},
		params: { dance: 'bachata' },
		route: { id: '/[dance]/(moves)/positions/map' },
		get url() {
			return at.url;
		}
	}
}));

const read = (f: string) => readFileSync(f, 'utf8');
const code = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

const PANE = 'src/lib/components/positions/MapPane.svelte';
const TRAY = 'src/lib/components/positions/MapTray.svelte';
const PANEL = 'src/lib/components/positions/MapPanel.svelte';
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

describe('a position’s sheet in MapPane', () => {
	const two = () =>
		data({ nodes: [node(1), node(2, null, 200, 300)], edges: [{ from: 1, to: 2 }] });

	it('?pick= arrives with that position’s sheet up, in place of the tray', () => {
		at.url = new URL('http://localhost/bachata/positions/map?pick=1');
		try {
			const html = pane(two());
			expect(html).toMatch(/<h2[^>]*>\s*P1\s*<\/h2>/);
			expect(html).toContain('Step to');
			expect(html).not.toContain('Tap a position to see where it leads.');
		} finally {
			at.url = new URL('http://localhost/bachata/positions/map');
		}
	});

	it('no pick: the tray, no sheet', () => {
		const html = pane(two());
		expect(html).toContain('Tap a position to see where it leads.');
		expect(html).not.toContain('Step to');
	});

	it('a Step to row or a pill steps; a From chip starts afresh; ‹ steps back', () => {
		const src = code(read(PANE));
		expect(src).toContain('onstep={onpick}');
		expect(src).toContain('onfresh={pickFresh}');
		expect(src).toContain('onback={() => (trail = stepBack(trail))}');
		expect(src).toContain('else trail = pick(trail, id, map);');
		expect(src).toContain("mode={walk ? 'walk' : sheet ? 'position' : 'tray'}");
		// Escape and empty space close as Back does; a walk ignores empty space and asks on Escape.
		expect(src).toContain('if (!walk) close();');
		expect(src).toContain('leaveWalk(close);');
	});

	it('walks from the sheet: Walk from here starts it, a pill only jumps, Back asks', () => {
		const src = code(read(PANE));
		expect(src).toContain('onwalk={() => (walk = { start: sheet.id, steps: [] })}');
		expect(src).toContain('if (walk) walk = jumpTo(walk, id);');
		expect(src).toContain('tryLeave={leaveWalk}');
		expect(src).toContain('leaveOrAsk(walkNode, leave, t().common.close)');
	});

	it('the panel holds one history entry while it is up, and lets it go when it closes', () => {
		const src = code(read(PANEL));
		expect(src).toMatch(/if \(up && key === null\) \{\s*key = sheetStack\.open\(/);
		expect(src).toContain('close: () => onclose()');
		expect(src).toMatch(/if \(!up\) release\(\);/);
		expect(src).toContain('sheetStack.closedByOwner(k)');
		// Not the app's modal Sheet: the map keeps taking taps.
		expect(src).not.toMatch(/<dialog\b|showModal/);
	});
});

describe('MapSheet', () => {
	const fig = (id: number, label: string, move = label) => ({ id, label, move });
	const full: PositionSheet = {
		id: 1,
		name: 'Open, two hands',
		ins: 2,
		outs: 5,
		stays: [fig(1, 'Basic · A', 'Basic'), fig(2, 'Basic · B', 'Basic')],
		from: [
			{ id: 2, name: 'Closed' },
			{ id: 3, name: 'Shadow' }
		],
		stepTo: [
			{
				id: 4,
				name: 'Cradle',
				tone: 'done',
				figs: [fig(3, 'To Cradle'), fig(4, 'Paso Madrid')],
				short: 'To Cradle · Paso Madrid'
			}
		],
		anywhere: [fig(5, 'Free spin')]
	};
	const props = {
		sheet: full,
		prev: { id: 9, name: 'Lasso' } as { id: number; name: string } | null,
		onstep: () => {},
		onfresh: () => {},
		onback: () => {}
	};
	const sheet = (p: Partial<typeof props> & { onwalk?: () => void } = {}) =>
		render(MapSheet, { props: { ...props, ...p } }).body;

	it('draws every part in the spec’s order', () => {
		const html = sheet();
		const order = [
			'aria-label="Back to Lasso"',
			'Open, two hands',
			'2 figures in · 5 out',
			'href="/bachata/positions/1"',
			'Stays here:',
			'Basic ×2',
			'From',
			'>Closed</button>',
			'>Shadow</button>',
			'Step to',
			'Cradle',
			'To Cradle · Paso Madrid',
			'Anywhere',
			'No end set: Free spin'
		];
		const pos = order.map((s) => html.indexOf(s));
		expect(pos.every((i) => i >= 0)).toBe(true);
		expect(pos).toEqual([...pos].sort((a, b) => a - b));
		expect(html).not.toContain('Nothing leads here yet');
		expect(html).not.toContain('Nothing leaves here yet');
	});

	it('the rows and chips are buttons; the Anywhere row is not', () => {
		const html = sheet();
		expect(html).toMatch(/<button[^>]*>[\s\S]*?Cradle[\s\S]*?<\/button>/);
		expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>)[\s\S])*Free spin/);
	});

	it('no ‹ when you did not step here', () => {
		expect(sheet({ prev: null })).not.toContain('Back to');
	});

	it('nothing leads in, nothing leaves: the danger lines, no rows', () => {
		const html = sheet({ sheet: { ...full, stays: [], from: [], stepTo: [], anywhere: [] } });
		expect(html).toContain('Nothing leads here yet');
		expect(html).toContain('Nothing leaves here yet');
		expect(html).not.toContain('<ul');
		expect(html).not.toContain('Stays here:');
	});

	it('only figures with no end: the Anywhere row, not the nothing-out line', () => {
		const html = sheet({ sheet: { ...full, stepTo: [] } });
		expect(html).toContain('No end set: Free spin');
		expect(html).not.toContain('Nothing leaves here yet');
	});

	it('Walk from here only when it is wired (Task 9)', () => {
		expect(sheet()).not.toContain('Walk from here');
		expect(sheet({ onwalk: () => {} })).toContain('Walk from here');
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
