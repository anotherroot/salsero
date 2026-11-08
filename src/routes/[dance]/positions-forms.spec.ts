/* eslint-disable @typescript-eslint/no-explicit-any -- a load and an action answer loosely typed here */
/**
 * The Positions list: what its load reads (a person's own and the group
 * positions they may use, or a group's own in group mode) and its two
 * actions, New position (`create`) and Templates (`templates`).
 *
 * Like `dance-wall.spec.ts`, the routes reach the database through `getDb()`,
 * which is mocked: each test gets its own `openDb(':memory:')`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

// The list's counts are read once for every row, not once per row (`counts` below).
vi.mock('$lib/graph/graph', async () => {
	const actual = await vi.importActual<typeof import('$lib/graph/graph')>('$lib/graph/graph');
	return { ...actual, positionCounts: vi.fn(actual.positionCounts) };
});

import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import {
	figureEndPositions,
	figureStartPositions,
	lessonAdds,
	lessonFigures,
	lessonPositions,
	lessons,
	positions,
	teamChanges,
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
import { crossRefs } from '$lib/server/integrity';
import { runInLocale } from '$lib/server/i18n-request';
import { actions } from './(moves)/positions/+page.server';
import { load as layoutLoad } from './(moves)/+layout.server';
import { parsePositionFilter, positionsView, type PositionsLists } from '$lib/positions/filter';

/**
 * The Positions list as the page shows it: the layout's unfiltered lists
 * through the pure parse and view, with the URL's filter.
 */
const load = (e: { url: URL }) => {
	const l = (layoutLoad as unknown as (e: unknown) => { lists: { positions: PositionsLists } })({
		...(e as object),
		depends: () => {}
	}).lists.positions;
	const filter = parsePositionFilter(e.url.searchParams, l.types, l.inGroupMode);
	return { ...l, ...positionsView(l, filter), filter };
};
import { load as noneLoadFn } from './(moves)/positions/none/+page.server';
import { positionCounts } from '$lib/graph/graph';

let db: Db;

function jar(value?: string) {
	const calls = { deleted: 0 };
	const cookies = {
		get: (n: string) => (n === groupCookie('salsa') ? value : undefined),
		set: () => {},
		delete: () => {
			calls.deleted++;
		}
	} as unknown as Cookies;
	return { cookies, calls };
}

const locals = (id: string, dance: 'salsa' | 'bachata' = 'salsa') =>
	({
		user: { id, timezone: 'Europe/Ljubljana', dance, role: 'user' }
	}) as unknown as App.Locals;

/** A form body; an array value posts the key once per entry. */
function body(fields: Record<string, string | string[]>): Request {
	const f = new URLSearchParams();
	for (const [k, v] of Object.entries(fields)) {
		for (const one of Array.isArray(v) ? v : [v]) f.append(k, one);
	}
	return new Request('http://localhost/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: f
	});
}

async function act(
	name: 'create' | 'templates',
	user: string,
	fields: Record<string, string | string[]>,
	cookies: Cookies = jar().cookies
): Promise<any> {
	try {
		return await (actions[name] as (e: unknown) => unknown)({
			params: { dance: 'salsa' },
			locals: locals(user),
			cookies,
			request: body(fields),
			url: new URL('http://x/salsa/positions')
		});
	} catch (e) {
		return e; // a redirect or an error
	}
}

const loadOf = (user: string, cookies: Cookies = jar().cookies, search = '') =>
	(load as (e: any) => unknown)({
		params: { dance: 'salsa' },
		locals: locals(user),
		cookies,
		url: new URL(`http://x/salsa/positions${search}`)
	}) as any;

const FIGURE = { figureName: 'Enchufla', name: 'Basic', partner: 'partner', style: 'salsa' };
const figure = (space: typeof T1_SALSA | typeof U2_SALSA, figureName: string) =>
	createFigure(db, space, { ...FIGURE, figureName, notes: null } as never)!.figure.id;
const tag = (side: 'start' | 'end', figureId: number, positionId: number) =>
	db
		.insert(side === 'start' ? figureStartPositions : figureEndPositions)
		.values({ figureId, positionId })
		.run();
const owned = (where: { userId?: string; teamId?: number }) =>
	db
		.select()
		.from(positions)
		.all()
		.filter((p) =>
			where.userId ? p.userId === where.userId : p.teamId === where.teamId && p.userId === null
		);

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', 1);
	joinTeam(db, 'u2', 1, 2);
	joinTeam(db, 'u3', 1, 2);
	setRole(db, 1, 'u2', 'editor');
});

describe('New position', () => {
	it('creates the position with its type and hold, and goes to its page', async () => {
		const r = await act('create', 'u2', {
			name: '  Manos cruzadas ',
			styleTag: 'son',
			hands: 'two',
			crossed: '1',
			facing: 'face',
			frame: 'closed',
			notes: 'Right on top.'
		});
		const [p] = owned({ userId: 'u2' });
		expect(r).toMatchObject({ status: 303, location: `/salsa/positions/${p.id}` });
		expect(p).toMatchObject({
			name: 'Manos cruzadas',
			dance: 'salsa',
			teamId: null,
			styleTag: 'son',
			hands: 'two',
			crossed: true,
			facing: 'face',
			frame: 'closed',
			notes: 'Right on top.'
		});
	});

	it('refuses a name already taken (folded) under the Name field, keeping what was typed', async () => {
		addPosition(db, U2_SALSA, 'Cerrada');
		const r = await act('create', 'u2', { name: 'CERRADÁ', styleTag: 'salsa', notes: 'Low' });
		expect(r).toMatchObject({
			status: 400,
			data: {
				action: 'create',
				field: 'name',
				message: 'You already have a position called CERRADÁ.',
				name: 'CERRADÁ',
				notes: 'Low',
				styleTag: 'salsa'
			}
		});
		expect(owned({ userId: 'u2' })).toHaveLength(1);
	});

	it('refuses an empty name under the Name field', async () => {
		const r = await act('create', 'u2', { name: '  ', styleTag: 'salsa' });
		expect(r).toMatchObject({ status: 400, data: { field: 'name', message: 'Give it a name.' } });
		expect(owned({ userId: 'u2' })).toEqual([]);
	});

	it('refuses notes that are too long under the Notes field', async () => {
		const r = await act('create', 'u2', { name: 'Cerrada', notes: 'x'.repeat(2001) });
		expect(r).toMatchObject({ status: 400, data: { field: 'notes' } });
		expect(owned({ userId: 'u2' })).toEqual([]);
	});

	it('creates in the group in group mode, logged with its actor, beside a same-named own one', async () => {
		addPosition(db, U2_SALSA, 'Cerrada');
		const r = await act('create', 'u2', { name: 'Cerrada', styleTag: 'salsa' }, jar('1').cookies);
		const [g] = owned({ teamId: 1 });
		expect(g).toMatchObject({ name: 'Cerrada', teamId: 1, userId: null, styleTag: 'salsa' });
		expect(r).toMatchObject({ status: 303, location: `/salsa/positions/${g.id}` });
		const log = db.select().from(teamChanges).where(eq(teamChanges.rootKind, 'position')).all();
		expect(log).toMatchObject([{ actorId: 'u2', teamId: 1, rootId: g.id, verb: 'add' }]);
		// The group's own name check: a second one is refused, naming the group.
		const again = await act('create', 'u2', { name: 'cerrada' }, jar('1').cookies);
		expect(again).toMatchObject({
			status: 400,
			data: { field: 'name', message: 'Tuesdays already has a position called cerrada.' }
		});
		expect(crossRefs(db)).toEqual([]);
	});

	it('never creates in a group for a member who is not an editor: their cookie falls back to Mine', async () => {
		const j = jar('1');
		await act('create', 'u3', { name: 'Cerrada' }, j.cookies);
		expect(owned({ teamId: 1 })).toEqual([]);
		expect(owned({ userId: 'u3' }).map((p) => p.name)).toEqual(['Cerrada']);
		expect(j.calls.deleted).toBe(1);
		expect(db.select().from(teamChanges).where(eq(teamChanges.rootKind, 'position')).all()).toEqual(
			[]
		);
	});
});

describe('Templates', () => {
	it('adds 3 of 4 when one is already had (folded), with the type, the hold and the notes', async () => {
		addPosition(db, U2_SALSA, 'manos CRUZADAS');
		const r = await act('templates', 'u2', {
			type: 'son',
			names: ['Cerrada de son', 'Abierta', 'Manos cruzadas', 'Paseo']
		});
		expect(r).toEqual({ action: 'templates', added: 3 });
		const rows = owned({ userId: 'u2' });
		expect(rows.map((p) => p.name).sort()).toEqual(
			['Abierta', 'Cerrada de son', 'Paseo', 'manos CRUZADAS'].sort()
		);
		const paseo = rows.find((p) => p.name === 'Paseo')!;
		expect(paseo).toMatchObject({
			styleTag: 'son',
			notes: 'Side by side, walking',
			facing: 'side'
		});
	});

	it('adds to the group in group mode', async () => {
		const r = await act('templates', 'u2', { type: 'salsa', names: ['Cerrada'] }, jar('1').cookies);
		expect(r).toEqual({ action: 'templates', added: 1 });
		expect(owned({ teamId: 1 }).map((p) => p.name)).toEqual(['Cerrada']);
		expect(owned({ userId: 'u2' })).toEqual([]);
	});

	it('refuses a type that has no templates, and an empty pick', async () => {
		expect(await act('templates', 'u2', { type: 'sensual', names: ['Closed'] })).toMatchObject({
			status: 400,
			data: { action: 'templates' }
		});
		expect(await act('templates', 'u2', { type: 'salsa' })).toMatchObject({
			status: 400,
			data: { action: 'templates' }
		});
		expect(owned({ userId: 'u2' })).toEqual([]);
	});
});

describe('the list', () => {
	it('is empty for a person with no positions, and still counts their figures', () => {
		figure(U2_SALSA, 'Enchufla');
		figure(U2_SALSA, 'Dile que no');
		const d = loadOf('u2');
		expect(d.rows).toEqual([]);
		expect(d.groups).toEqual([]);
		expect(d.tagged).toEqual({ done: 0, total: 2 });
		expect(d.none).toEqual({ none: 2, onlyStart: 0, onlyEnd: 0 });
		expect(d.gaps).toBe(0);
		expect(d.owned).toEqual([]);
		expect(d.inGroupMode).toBe(false);
		// The layout's `groupMode` (an object the shell reads) must not be shadowed by the page's flag.
		expect(d).not.toHaveProperty('groupMode');
		expect(d.types).toEqual(['salsa', 'son', 'timba', 'other']);
	});

	it('reads own rows with their counts and gaps, then the group positions a lesson brought', () => {
		const cerrada = addPosition(db, U2_SALSA, 'Cerrada');
		const caida = addPosition(db, U2_SALSA, 'Caída');
		addPosition(db, U2_SALSA, 'Sombra');
		db.update(positions).set({ styleTag: 'timba' }).where(eq(positions.id, caida)).run();
		const a = figure(U2_SALSA, 'Enchufla');
		tag('start', a, cerrada);
		tag('end', a, caida);
		figure(U2_SALSA, 'Dile que no'); // no position
		// The group's Hammerlock reaches u2 through a lesson they added.
		const hammer = addPosition(db, T1_SALSA, 'Hammerlock');
		const lesson = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-03',
			title: 'Week 6',
			notes: null
		}).lesson.id;
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, lesson)).run();
		db.insert(lessonPositions).values({ lessonId: lesson, positionId: hammer }).run();
		db.insert(lessonAdds).values({ userId: 'u2', lessonId: lesson, addedAt: 1, seenAt: 1 }).run();

		vi.mocked(positionCounts).mockClear();
		const d = loadOf('u2');
		expect(d.rows.map((r: any) => r.name)).toEqual(['Caída', 'Cerrada', 'Sombra']);
		// One pass over the graph for all four rows (three own, one group's).
		expect(vi.mocked(positionCounts)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(positionCounts).mock.calls[0][1]).toHaveLength(4);
		const byName = (n: string) => d.rows.find((r: any) => r.name === n);
		expect(byName('Cerrada')).toMatchObject({ outCount: 1, inCount: 0, orphan: true });
		expect(byName('Caída')).toMatchObject({ inCount: 1, deadEnd: true, styleTag: 'timba' });
		expect(byName('Sombra')).toMatchObject({ unused: true, twins: false, from: null });
		expect(d.gaps).toBe(2);
		expect(d.tagged).toEqual({ done: 1, total: 2 });
		expect(d.none).toEqual({ none: 1, onlyStart: 0, onlyEnd: 0 });
		expect(d.owned).toEqual(['caida', 'cerrada', 'sombra']);
		expect(d.groups).toMatchObject([
			{
				team: { id: 1, name: 'Tuesdays' },
				rows: [{ id: hammer, name: 'Hammerlock', from: 'Week 6' }]
			}
		]);

		// The chips: a type, Gaps, and the search, each over both sections.
		expect(loadOf('u2', undefined, '?type=timba').rows.map((r: any) => r.name)).toEqual(['Caída']);
		const gaps = loadOf('u2', undefined, '?gaps=1');
		expect(gaps.rows.map((r: any) => r.name)).toEqual(['Caída', 'Cerrada']);
		expect(gaps.groups).toEqual([]);
		expect(gaps.filter).toEqual({ q: '', gaps: '1' });
		const q = loadOf('u2', undefined, '?q=HAMM');
		expect(q.rows).toEqual([]);
		expect(q.groups[0].rows.map((r: any) => r.name)).toEqual(['Hammerlock']);
		// An unknown type is no filter.
		expect(loadOf('u2', undefined, '?type=bogus').filter).toEqual({ q: '' });
	});

	it('hides a group position the person has their own copy of, and folds twins', () => {
		const mine = addPosition(db, U2_SALSA, 'Cerrada', { geneId: 'c' });
		const theirs = addPosition(db, T1_SALSA, 'Cerrada', { geneId: 'c' });
		const hammer = addPosition(db, T1_SALSA, 'Hammerlock');
		const lock = addPosition(db, U2_SALSA, 'Lock');
		const lesson = createLesson(db, T1_SALSA, {
			lessonDay: '2026-11-03',
			title: 'Week 6',
			notes: null
		}).lesson.id;
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, lesson)).run();
		for (const positionId of [theirs, hammer])
			db.insert(lessonPositions).values({ lessonId: lesson, positionId }).run();
		db.insert(lessonAdds).values({ userId: 'u2', lessonId: lesson, addedAt: 1, seenAt: 1 }).run();
		// Same as…: u2's Lock and the group's Hammerlock are one.
		for (const itemId of [lock, hammer])
			db.insert(twins).values({ userId: 'u2', kind: 'position', setId: 's', itemId }).run();

		const d = loadOf('u2');
		expect(d.rows.map((r: any) => [r.name, r.twins])).toEqual([
			['Cerrada', false],
			['Lock', true]
		]);
		expect(d.rows[0].id).toBe(mine);
		expect(d.groups).toEqual([]);
	});

	it("reads only the group's own in group mode, with no gap report and no groups", () => {
		const ours = addPosition(db, T1_SALSA, 'Abierta');
		addPosition(db, U2_SALSA, 'Mine only');
		const f = figure(T1_SALSA, 'Setenta');
		tag('end', f, ours);
		const d = loadOf('u2', jar('1').cookies, '?gaps=1');
		expect(d.inGroupMode).toBe(true);
		expect(d).not.toHaveProperty('groupMode');
		expect(d.rows).toMatchObject([
			{ id: ours, name: 'Abierta', inCount: 1, deadEnd: false, orphan: false, island: false }
		]);
		expect(d.gaps).toBe(0);
		expect(d.groups).toEqual([]);
		expect(d.owned).toEqual(['abierta']);
		expect(d.filter).toEqual({ q: '' });
		expect(
			db
				.select()
				.from(positions)
				.where(and(eq(positions.teamId, 1)))
				.all()
		).toHaveLength(1);
	});
});

describe('No position', () => {
	const noneLoad = (user: string, cookies: Cookies = jar().cookies) =>
		(noneLoadFn as (e: unknown) => unknown)({
			params: { dance: 'salsa' },
			locals: locals(user),
			cookies,
			url: new URL('http://x/salsa/positions/none')
		}) as any;

	it('groups the figures missing a side, with the tag on the side they have', () => {
		const cerrada = addPosition(db, U2_SALSA, 'Cerrada');
		const caida = addPosition(db, U2_SALSA, 'Caída');
		const both = figure(U2_SALSA, 'Both');
		tag('start', both, cerrada);
		tag('end', both, cerrada);
		const bare = figure(U2_SALSA, 'Bare');
		const onlyEnd = figure(U2_SALSA, 'Ends');
		tag('end', onlyEnd, caida);
		const onlyStart = figure(U2_SALSA, 'Starts');
		tag('start', onlyStart, cerrada);
		const d = noneLoad('u2');
		expect(d.head).toBe('3 figures · 1 with none, 2 with only a start or an end');
		expect(d.groups.map((g: any) => g.title)).toEqual([
			'No start and no end · 1',
			'Only an end · 1',
			'Only a start · 1'
		]);
		expect(d.groups[0].rows).toMatchObject([
			{ id: bare, label: 'Bare · Basic', tag: null, canEdit: true }
		]);
		expect(d.groups[1].rows).toMatchObject([{ id: onlyEnd, tag: 'ends in Caída', canEdit: true }]);
		expect(d.groups[2].rows[0].tag).toBe('starts in Cerrada');
		expect(d.groups[2].rows[0].meta).toMatch(/^Salsa/);
	});

	it('hides empty groups and says so when every figure is tagged', () => {
		const p = addPosition(db, U2_SALSA, 'Cerrada');
		const f = figure(U2_SALSA, 'Both');
		tag('start', f, p);
		tag('end', f, p);
		const d = noneLoad('u2');
		expect(d.groups).toEqual([]);
		expect(d.empty).toBe(true);
	});

	it("reads the group's figures in group mode for an editor", () => {
		const gf = figure(T1_SALSA, 'Setenta');
		figure(U2_SALSA, 'Mine');
		const editor = noneLoad('u2', jar('1').cookies);
		expect(editor.groups[0].rows).toMatchObject([{ id: gf, canEdit: true }]);
	});

	it('a member sees only the group figures a published lesson they added reaches', () => {
		const draftFig = figure(T1_SALSA, 'Draft one');
		const publishedFig = figure(T1_SALSA, 'Published one');
		figure(T1_SALSA, 'Unlinked');
		const lessonOf = (title: string, figureId: number, published: boolean) => {
			const id = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title, notes: null }).lesson
				.id;
			if (published) db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, id)).run();
			db.insert(lessonFigures).values({ lessonId: id, figureId }).run();
			return id;
		};
		lessonOf('Draft', draftFig, false);
		const pub = lessonOf('Published', publishedFig, true);
		db.insert(lessonAdds).values({ userId: 'u3', lessonId: pub, addedAt: 1, seenAt: 1 }).run();

		const member = noneLoad('u3', jar('1').cookies);
		const ids = member.groups.flatMap((g: any) => g.rows.map((r: any) => r.id));
		expect(ids).toEqual([publishedFig]);
		expect(member.groups[0].rows[0].canEdit).toBe(false);
		expect(member.head).toBe('1 figure · 1 with none, 0 with only a start or an end');
		// The editor still sees all three.
		const editor = noneLoad('u2', jar('1').cookies);
		expect(editor.groups[0].rows).toHaveLength(3);
	});

	it("Mine mode never shows another person's figure", () => {
		figure(U1_SALSA, "u1's");
		const mine = figure(U2_SALSA, "u2's");
		const d = noneLoad('u2');
		expect(d.groups[0].rows.map((r: any) => r.id)).toEqual([mine]);
	});
});

describe('the list’s chips and group order', () => {
	/** A group position reaching u2 through a published lesson u2 added. */
	const reach = (teamId: number, name: string) => {
		const space = { teamId, actorId: teamId === 1 ? 'u1' : 'u3', dance: 'salsa' as const };
		const p = addPosition(db, space, name);
		const lesson = createLesson(db, space, {
			lessonDay: '2026-11-03',
			title: `Week of ${name}`,
			notes: null
		}).lesson.id;
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, lesson)).run();
		db.insert(lessonPositions).values({ lessonId: lesson, positionId: p }).run();
		db.insert(lessonAdds).values({ userId: 'u2', lessonId: lesson, addedAt: 1, seenAt: 1 }).run();
		return p;
	};

	it('orders the group sections by group name, and says when nothing is your own', () => {
		createTeam(db, 'u3', 'salsa', 'Abacus', 1);
		joinTeam(db, 'u2', 2, 2);
		reach(1, 'Hammerlock');
		reach(2, 'Cuddle');
		const d = loadOf('u2');
		expect(d.rows).toEqual([]);
		expect(d.groups.map((g: any) => g.team.name)).toEqual(['Abacus', 'Tuesdays']);
		// Only a group's positions: no Gaps chip to show "Gaps 0".
		expect(d.hasOwn).toBe(false);
		expect(d.untyped).toBe(true);
		addPosition(db, U2_SALSA, 'Mine');
		expect(loadOf('u2').hasOwn).toBe(true);
	});

	it('takes Other where the dance has no such type, for untyped rows (bachata)', () => {
		const bachata = { userId: 'u2', dance: 'bachata' as const };
		const p = addPosition(db, bachata, 'Closed');
		const typed = addPosition(db, bachata, 'Open');
		db.update(positions).set({ styleTag: 'sensual' }).where(eq(positions.id, typed)).run();
		const loadBachata = (search: string) =>
			(load as (e: any) => unknown)({
				params: { dance: 'bachata' },
				locals: locals('u2', 'bachata'),
				cookies: jar().cookies,
				url: new URL(`http://x/bachata/positions${search}`)
			}) as any;
		const d = loadBachata('?type=other');
		expect(d.types).not.toContain('other');
		expect(d.untyped).toBe(true);
		expect(d.filter).toEqual({ q: '', type: 'other' });
		expect(d.rows.map((r: any) => r.id)).toEqual([p]);
		expect(loadBachata('?type=sensual').rows.map((r: any) => r.id)).toEqual([typed]);
	});
});

describe('the actions in Slovenian', () => {
	const sl = <T>(fn: () => Promise<T>) => runInLocale('sl', fn);

	it('refuses New position’s name and notes in Slovenian', async () => {
		addPosition(db, U2_SALSA, 'Cerrada');
		expect(await sl(() => act('create', 'u2', { name: 'cerrada' }))).toMatchObject({
			status: 400,
			data: { field: 'name', message: 'Položaj z imenom »cerrada« že imate.' }
		});
		expect(
			await sl(() => act('create', 'u2', { name: 'Abierta', notes: 'x'.repeat(2001) }))
		).toMatchObject({
			status: 400,
			data: { field: 'notes', message: 'Opombe imajo lahko največ 2000 znakov.' }
		});
	});

	it('refuses Templates in Slovenian, and writes the notes in Slovenian', async () => {
		expect(
			await sl(() => act('templates', 'u2', { type: 'sensual', names: ['Closed'] }))
		).toMatchObject({ status: 400, data: { message: 'Izberite slog s predlogami.' } });
		expect(await sl(() => act('templates', 'u2', { type: 'salsa' }))).toMatchObject({
			status: 400,
			data: { message: 'Označite vsaj en položaj.' }
		});
		await sl(() => act('templates', 'u2', { type: 'son', names: ['Paseo'] }));
		expect(owned({ userId: 'u2' })).toMatchObject([
			{ name: 'Paseo', notes: 'Drug ob drugem, v hoji' }
		]);
	});
});
