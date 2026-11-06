/* eslint-disable @typescript-eslint/no-explicit-any -- a load's answer is loosely typed here */
/**
 * The map (`mapData`): the viewer's graph (ruling 14) laid out, what each node is
 * called and coloured, the arrows' figure counts, the tray, and the summary.
 *
 * The two loads that serve it (the map route and the Positions list, whose pane
 * on the desktop is the map) reach the database through `getDb()`, which is
 * mocked as in `dance-wall.spec.ts`: each test gets its own `openDb(':memory:')`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import {
	figureEndPositions,
	figureStartPositions,
	lessonAdds,
	lessonFigures,
	lessons,
	positions,
	twins,
	users
} from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { createLesson } from '$lib/server/lessons';
import { createFigure } from '$lib/server/figures';
import { addPosition } from '$lib/server/test-positions';
import { T1_SALSA, U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { groupCookie } from '$lib/teams/mode';
import type { Space } from '$lib/server/scope';
import { groupModeOf } from '$lib/server/group-mode';
import { mapData } from '$lib/server/positions-map';
import { load } from './(moves)/positions/map/+page.server';
import { load as listLoad } from './(moves)/positions/+page.server';

let db: Db;

const jar = (value?: string) =>
	({
		get: (n: string) => (n === groupCookie('salsa') ? value : undefined),
		set: () => {},
		delete: () => {}
	}) as unknown as Cookies;

const locals = (id: string) =>
	({
		user: { id, timezone: 'Europe/Ljubljana', dance: 'salsa', role: 'user' }
	}) as unknown as App.Locals;

const loadOf = (user: string, cookies: Cookies = jar()) =>
	mapData(db, { userId: user, dance: 'salsa' }, groupModeOf(db, user, 'salsa', cookies)) as any;

/** A route's load, as SvelteKit calls it. */
const routeLoad = (fn: unknown, user: string | null, cookies: Cookies = jar()) =>
	(fn as (e: unknown) => unknown)({
		params: { dance: 'salsa' },
		locals: user === null ? {} : locals(user),
		cookies,
		url: new URL('http://x/salsa/positions')
	}) as any;

const FIGURE = { name: 'Basic', partner: 'partner', style: 'salsa' };
let n = 0;
const figure = (space: Space) =>
	createFigure(db, space, { ...FIGURE, figureName: `Move ${++n}`, notes: null } as never)!.figure
		.id;
const tag = (side: 'start' | 'end', figureId: number, positionId: number) =>
	db
		.insert(side === 'start' ? figureStartPositions : figureEndPositions)
		.values({ figureId, positionId })
		.run();
/** A figure of `space` from `from` to `to` (null: that side has none). */
const between = (space: Space, from: number | null, to: number | null) => {
	const f = figure(space);
	if (from !== null) tag('start', f, from);
	if (to !== null) tag('end', f, to);
	return f;
};
const typed = (id: number, styleTag: string) =>
	db.update(positions).set({ styleTag }).where(eq(positions.id, id)).run();

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	n = 0;
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', 1);
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	setRole(db, 1, 'u2', 'editor');
});

describe('the map', () => {
	it("lays out a person's own graph: nodes, tones, counts, arrows, the tray and the summary", () => {
		const cerrada = addPosition(db, U2_SALSA, 'Cerrada');
		const abierta = addPosition(db, U2_SALSA, 'Abierta');
		const caida = addPosition(db, U2_SALSA, 'Caída');
		const sombra = addPosition(db, U2_SALSA, 'Sombra');
		const ruedaA = addPosition(db, U2_SALSA, 'Rueda: centro');
		const ruedaB = addPosition(db, U2_SALSA, 'Rueda: círculo');
		typed(cerrada, 'salsa');
		typed(abierta, 'son');
		typed(caida, 'timba');
		between(U2_SALSA, cerrada, abierta);
		between(U2_SALSA, cerrada, abierta);
		between(U2_SALSA, abierta, cerrada);
		between(U2_SALSA, cerrada, caida); // Caída: a dead end
		between(U2_SALSA, abierta, abierta); // a loop
		between(U2_SALSA, ruedaA, ruedaB); // an island
		between(U2_SALSA, null, null); // no position
		between(U2_SALSA, cerrada, null); // only a start
		// Someone else's never shows.
		const theirs = addPosition(db, U1_SALSA, 'Theirs');
		between(U1_SALSA, theirs, theirs);

		const d = loadOf('u2');
		expect(d.empty).toBe(false);
		expect(d.inGroupMode).toBe(false);
		expect(d.layout.nodes.map((x: any) => x.id)).toEqual([abierta, caida, cerrada]);
		expect(d.layout.tray).toEqual({ islands: [ruedaA, ruedaB], unused: [sombra] });
		const node = (id: number) => d.layout.nodes.find((x: any) => x.id === id);
		expect(node(caida).mark).toBe('dead end');
		expect(node(cerrada).mark).toBe(null);
		expect(node(cerrada).r).toBeGreaterThan(node(caida).r);

		const pos = (id: number) => d.positions.find((p: any) => p.id === id);
		expect(d.positions.map((p: any) => p.id).sort()).toEqual(
			[cerrada, abierta, caida, sombra, ruedaA, ruedaB].sort()
		);
		expect(pos(cerrada)).toMatchObject({
			name: 'Cerrada',
			label: 'Cerrada',
			tone: 'accent',
			ins: 1,
			outs: 4,
			ariaLabel: 'Cerrada · 1 in · 4 out'
		});
		expect(pos(abierta)).toMatchObject({ tone: 'done', ins: 3, outs: 2 });
		expect(pos(caida)).toMatchObject({
			tone: 'warn',
			ariaLabel: 'Caída · 1 in · 0 out · dead end'
		});
		expect(pos(sombra)).toMatchObject({ tone: 'muted', ins: 0, outs: 0 });

		expect(d.edges).toEqual(
			[
				{ from: cerrada, to: abierta, width: 3, figures: 2 },
				{ from: cerrada, to: caida, width: 2, figures: 1 },
				{ from: abierta, to: cerrada, width: 2, figures: 1 },
				{ from: abierta, to: abierta, width: 2, figures: 1 }
			].sort((a, b) => a.from - b.from || a.to - b.to)
		);
		expect(d.noPosition).toBe(2);
		expect(d.summary).toBe('6 positions · 6 figures between them · 2 with none · 3 stranded');
		expect(d.types.map((t: any) => [t.label, t.tone])).toEqual([
			['Salsa', 'accent'],
			['Son', 'done'],
			['Timba', 'warn'],
			['Other', 'muted']
		]);
		expect(d.mapLabel).toBe('The map of your positions');
	});

	it("draws the group's own in group mode, with no gap marks", () => {
		const open = addPosition(db, T1_SALSA, 'Abierta');
		const end = addPosition(db, T1_SALSA, 'Caída');
		between(T1_SALSA, open, end);
		const mine = addPosition(db, U2_SALSA, 'Mine only');
		between(U2_SALSA, mine, mine);

		const d = loadOf('u2', jar('1'));
		expect(d.inGroupMode).toBe(true);
		expect(d.layout.nodes.map((x: any) => [x.id, x.mark])).toEqual([
			[open, null],
			[end, null]
		]);
		expect(d.positions.map((p: any) => p.id)).toEqual([open, end]);
		expect(d.summary).toBe('2 positions · 1 figure between them');
		expect(d.mapLabel).toBe('The map of the group’s positions');
	});

	it("adds the group's figures and positions a member may use", () => {
		const a = addPosition(db, T1_SALSA, 'Hammerlock');
		const b = addPosition(db, T1_SALSA, 'Cuddle');
		const f = between(T1_SALSA, a, b);
		between(T1_SALSA, b, a); // not in any lesson: out of u3's reach
		const lesson = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-03',
			title: 'Week 6',
			notes: null
		}).lesson.id;
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, lesson)).run();
		db.insert(lessonFigures).values({ lessonId: lesson, figureId: f }).run();

		// Before Add, nothing of the group's.
		expect(loadOf('u3').empty).toBe(true);
		db.insert(lessonAdds).values({ userId: 'u3', lessonId: lesson, addedAt: 1, seenAt: 1 }).run();
		const d = loadOf('u3');
		expect(d.layout.nodes.map((x: any) => x.id)).toEqual([b, a]);
		expect(d.edges).toEqual([{ from: a, to: b, width: 2, figures: 1 }]);
		expect(d.positions.find((p: any) => p.id === b)).toMatchObject({ ins: 1, outs: 0 });
	});

	it('draws twinned positions as one node, marked (ruling 16)', () => {
		const lock = addPosition(db, U2_SALSA, 'Lock');
		const hammer = addPosition(db, U2_SALSA, 'Hammer');
		const other = addPosition(db, U2_SALSA, 'Other');
		between(U2_SALSA, lock, other);
		between(U2_SALSA, other, hammer);
		// Apart, Lock is an orphan and Hammer a dead end.
		expect(loadOf('u2').layout.nodes.map((x: any) => [x.id, x.mark, x.twins])).toEqual([
			[hammer, 'dead end', false],
			[lock, 'orphan', false],
			[other, null, false]
		]);
		for (const itemId of [lock, hammer])
			db.insert(twins).values({ userId: 'u2', kind: 'position', setId: 's', itemId }).run();
		const d = loadOf('u2');
		// One node for the pair, under the lowest id of the person's own: no gaps left.
		expect(d.layout.nodes.map((x: any) => [x.id, x.mark, x.twins])).toEqual([
			[lock, null, true],
			[other, null, false]
		]);
		expect(d.edges.map((e: any) => [e.from, e.to])).toEqual([
			[lock, other],
			[other, lock]
		]);
		const node = d.positions.find((p: any) => p.id === lock);
		expect(node.twinsLine).toBe('Twins: your Lock, your Hammer');
		expect(node.ariaLabel).toBe('Lock · 1 in · 1 out · Twins: your Lock, your Hammer');
		expect(d.positions.find((p: any) => p.id === other).twinsLine).toBe(null);
		expect(d.summary).toBe('2 positions · 2 figures between them');
	});

	it("names a group's twin by its group", () => {
		const closed = addPosition(db, T1_SALSA, 'Closed');
		const open = addPosition(db, T1_SALSA, 'Open');
		const f = between(T1_SALSA, closed, open);
		const lesson = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-03',
			title: 'Week 6',
			notes: null
		}).lesson.id;
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, lesson)).run();
		db.insert(lessonFigures).values({ lessonId: lesson, figureId: f }).run();
		db.insert(lessonAdds).values({ userId: 'u3', lessonId: lesson, addedAt: 1, seenAt: 1 }).run();
		const cerrada = addPosition(db, { userId: 'u3', dance: 'salsa' }, 'Cerrada');
		between({ userId: 'u3', dance: 'salsa' }, open, cerrada);
		for (const itemId of [closed, cerrada])
			db.insert(twins).values({ userId: 'u3', kind: 'position', setId: 's', itemId }).run();
		const d = loadOf('u3');
		// The person's own member stands for the pair, though the group's id is lower.
		expect(d.layout.nodes.map((x: any) => [x.id, x.twins])).toEqual([
			[cerrada, true],
			[open, false]
		]);
		expect(d.positions.find((p: any) => p.id === cerrada).twinsLine).toBe(
			'Twins: your Cerrada, Tuesdays’ Closed'
		);
		// The group's own map, in group mode, reads them apart.
		const g = loadOf('u2', jar('1'));
		expect(g.layout.nodes.every((x: any) => !x.twins)).toBe(true);
	});

	it('is empty with no positions, and keeps the No position count', () => {
		between(U2_SALSA, null, null);
		const d = loadOf('u2');
		expect(d.empty).toBe(true);
		expect(d.layout).toMatchObject({ width: 0, height: 0, nodes: [], edges: [] });
		expect(d.positions).toEqual([]);
		expect(d.noPosition).toBe(1);
	});

	it('is what the map route and the Positions list both load, in group mode too', () => {
		const a = addPosition(db, U2_SALSA, 'Cerrada');
		between(U2_SALSA, a, a);
		const g = addPosition(db, T1_SALSA, 'Abierta');
		between(T1_SALSA, g, g);
		for (const cookies of [jar(), jar('1')]) {
			const map = loadOf('u2', cookies);
			expect(map.positions.length).toBe(1);
			expect(routeLoad(load, 'u2', cookies)).toEqual({ map });
			expect(routeLoad(listLoad, 'u2', cookies)).toEqual({ map });
		}
	});

	it('refuses without a user', () => {
		expect(() => routeLoad(load, null)).toThrow();
		expect(() => routeLoad(listLoad, null)).toThrow();
	});
});
