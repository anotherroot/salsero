/* eslint-disable @typescript-eslint/no-explicit-any -- a load and an action answer loosely typed here */
/**
 * A position's page: what its load reads (figures from and into it, routines
 * through it, the clone data, a reader's Make it mine) and its own actions
 * (`update`, `archive`, `restore`, `makeMine`); and the figures list's New
 * move preset with the position (`?start=` / `?end=`, ruling 8).
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

import { and, eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import {
	figureEndPositions,
	figureStartPositions,
	figures,
	lessonAdds,
	lessonFigures,
	lessonPositions,
	lessons,
	positions,
	recordings,
	spotPositionLinks,
	teamChanges,
	teamTrash,
	users,
	videoSpots
} from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { addLessonVideo, createLesson } from '$lib/server/lessons';
import { addSpot } from '$lib/server/spots';
import { linkSpotToPosition } from '$lib/server/position-links';
import type { Space } from '$lib/server/scope';
import { createFigure } from '$lib/server/figures';
import { createRoutineFromFigures } from '$lib/server/routines';
import { positionSeen } from '$lib/server/clash';
import { addPosition } from '$lib/server/test-positions';
import { T1_SALSA, U1_BACHATA, U2_SALSA } from '$lib/server/test-walls';
import { groupCookie } from '$lib/teams/mode';
import { crossRefs } from '$lib/server/integrity';
import { ARCHIVED_LINKS, PRESET_GONE } from '$lib/positions/view';
import { actions, load } from './(moves)/positions/[id]/+page.server';
import { actions as figureList, load as figureLoad } from './(moves)/figures/+page.server';

let db: Db;

function jar(value?: string): Cookies {
	return {
		get: (n: string) => (n === groupCookie('salsa') ? value : undefined),
		set: () => {},
		delete: () => {}
	} as unknown as Cookies;
}

const locals = (id: string) =>
	({ user: { id, timezone: 'Europe/Ljubljana', role: 'user' } }) as unknown as App.Locals;

function body(fields: Record<string, string>): Request {
	return new Request('http://localhost/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	});
}

type Name =
	| 'update'
	| 'archive'
	| 'restore'
	| 'makeMine'
	| 'linkSpot'
	| 'unlinkSpot'
	| 'linkLesson'
	| 'unlinkLesson';
async function act(
	name: Name,
	user: string,
	id: number,
	fields: Record<string, string> = {},
	cookies: Cookies = jar()
): Promise<any> {
	try {
		return await (actions[name] as (e: unknown) => unknown)({
			params: { dance: 'salsa', id: String(id) },
			locals: locals(user),
			cookies,
			request: body(fields),
			url: new URL(`http://x/salsa/positions/${id}`)
		});
	} catch (e) {
		return e; // a redirect or an error
	}
}

function loadOf(user: string, id: number, cookies: Cookies = jar(), dance = 'salsa'): any {
	return (load as (e: unknown) => unknown)({
		params: { dance, id: String(id) },
		locals: locals(user),
		cookies,
		url: new URL(`http://x/${dance}/positions/${id}`)
	});
}
const loadErr = (user: string, id: number, dance = 'salsa') => {
	try {
		loadOf(user, id, jar(), dance);
	} catch (e) {
		return e;
	}
	return null;
};

const figure = (
	space: typeof T1_SALSA | typeof U2_SALSA,
	figureName: string,
	name: string,
	style = 'salsa'
) =>
	createFigure(db, space, { figureName, name, partner: 'partner', style, notes: null } as never)!
		.figure.id;
const tag = (side: 'start' | 'end', figureId: number, positionId: number) =>
	db
		.insert(side === 'start' ? figureStartPositions : figureEndPositions)
		.values({ figureId, positionId })
		.run();
const styled = (id: number, styleTag: string) =>
	db.update(positions).set({ styleTag }).where(eq(positions.id, id)).run();

/** The edit form's fields, as PositionSheet posts them. */
const fields = (over: Record<string, string> = {}) => ({
	name: 'Manos cruzadas',
	styleTag: 'son',
	hands: 'two',
	crossed: '1',
	facing: 'face',
	notes: 'Right on top.',
	...over
});

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

/** u2's Manos cruzadas (Son, crossed) with figures from and into it, and two routines. */
function own() {
	const p = addPosition(db, U2_SALSA, 'Manos cruzadas');
	db.update(positions)
		.set({ styleTag: 'son', hands: 'two', crossed: true, facing: 'face', notes: 'Right on top.' })
		.where(eq(positions.id, p))
		.run();
	const abierta = addPosition(db, U2_SALSA, 'Abierta');
	const setenta = addPosition(db, U2_SALSA, 'Setenta');
	styled(abierta, 'salsa');
	styled(setenta, 'salsa');
	// From: one figure with two ends, and one back into itself.
	const enchufla = figure(U2_SALSA, 'Enchufla', 'Complicada', 'son');
	tag('start', enchufla, p);
	tag('end', enchufla, setenta);
	tag('end', enchufla, abierta);
	const kentucky = figure(U2_SALSA, 'Kentucky', 'Doble', 'son');
	tag('start', kentucky, p);
	tag('end', kentucky, p);
	// Into: from Abierta.
	const dile = figure(U2_SALSA, 'Dile que no', 'Cruzado');
	tag('start', dile, abierta);
	tag('end', dile, p);
	// Not through it at all.
	const other = figure(U2_SALSA, 'Vuelta', 'Simple');
	tag('start', other, abierta);
	tag('end', other, setenta);
	const line = createRoutineFromFigures(db, U2_SALSA, { name: 'Kentucky line', notes: null }, [
		dile,
		enchufla,
		kentucky,
		kentucky
	])!.routine.id;
	createRoutineFromFigures(db, U2_SALSA, { name: 'Elsewhere', notes: null }, [other, dile]);
	return { p, abierta, setenta, enchufla, kentucky, dile, line };
}

/** The group's Hammerlock on its Setenta · Básico, reached by u3 through Week 6, which u3 added. */
function group() {
	const hammer = addPosition(db, T1_SALSA, 'Hammerlock');
	styled(hammer, 'salsa');
	const abierta = addPosition(db, T1_SALSA, 'Abierta');
	styled(abierta, 'salsa');
	const setenta = figure(T1_SALSA, 'Setenta', 'Básico');
	tag('start', setenta, hammer);
	tag('end', setenta, abierta);
	const lesson = createLesson(db, T1_SALSA, {
		lessonDay: '2026-11-03',
		title: 'Week 6',
		notes: null
	}).lesson.id;
	db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, lesson)).run();
	db.insert(lessonFigures).values({ lessonId: lesson, figureId: setenta }).run();
	db.insert(lessonAdds).values({ userId: 'u3', lessonId: lesson, addedAt: 1, seenAt: 1 }).run();
	return { hammer, abierta, setenta, lesson };
}

describe('the load', () => {
	it('reads an own position: its hold, figures from and into it, routines through it', () => {
		const o = own();
		const d = loadOf('u2', o.p);
		expect(d.position).toMatchObject({
			id: o.p,
			name: 'Manos cruzadas',
			styleTag: 'son',
			hold: { hands: 'two', crossed: true, facing: 'face', frame: null },
			notes: 'Right on top.',
			pictureSpotId: null,
			teamId: null,
			archived: false
		});
		expect(d.canEdit).toBe(true);
		expect(d.counts).toMatchObject({ inCount: 2, outCount: 2, deadEnd: false, orphan: false });
		// A figure with two ends is one row naming both; a type unlike Son is named.
		expect(d.from).toEqual([
			{
				id: o.enchufla,
				label: 'Enchufla · Complicada',
				style: 'Son',
				team: null,
				ends: ['Abierta, Salsa', 'Setenta, Salsa']
			},
			{
				id: o.kentucky,
				label: 'Kentucky · Doble',
				style: 'Son',
				team: null,
				ends: ['Manos cruzadas']
			}
		]);
		expect(d.into).toEqual([
			{
				id: o.dile,
				label: 'Dile que no · Cruzado',
				style: '',
				team: null,
				starts: ['Abierta, Salsa']
			},
			{
				id: o.kentucky,
				label: 'Kentucky · Doble',
				style: '',
				team: null,
				starts: ['Manos cruzadas']
			}
		]);
		// Slots 1 → 2 (Dile que no into Enchufla) and 3 → 4 (Kentucky twice); not Elsewhere.
		expect(d.routines).toEqual([
			{
				id: o.line,
				name: 'Kentucky line',
				pairs: [
					[1, 2],
					[3, 4]
				]
			}
		]);
		expect(d.makeMine).toBeNull();
		expect(d.historyHref).toBeNull();
		expect(d.team).toBeNull();
		expect(d.canTag).toBe(true);
		expect(d.seen).toEqual(positionSeen(db, o.p));
		expect(d.picture).toBeNull();
		expect(d.spots).toEqual([]);
		expect(d.lessons).toEqual([]);
	});

	it('marks a dead end: figures end in it and none leave', () => {
		const caida = addPosition(db, U2_SALSA, 'Caída');
		const f = figure(U2_SALSA, 'Dile que no', 'Con caída');
		tag('end', f, caida);
		const d = loadOf('u2', caida);
		expect(d.counts).toMatchObject({ inCount: 1, outCount: 0, deadEnd: true, orphan: false });
		expect(d.from).toEqual([]);
		expect(d.into).toHaveLength(1);
	});

	it("reads a group's position read-only for a member it reached, with Make it mine", () => {
		const g = group();
		const d = loadOf('u3', g.hammer);
		expect(d.canEdit).toBe(false);
		expect(d.team).toMatchObject({ id: 1, name: 'Tuesdays' });
		expect(d.fromLesson).toBe('Week 6');
		expect(d.makeMine).toMatchObject({ kind: 'position', label: 'Hammerlock', team: 'Tuesdays' });
		expect(d.historyHref).toBeNull();
		expect(d.seen).toEqual(positionSeen(db, g.hammer));
		// The group's figure, named as the group's.
		expect(d.from).toEqual([
			{
				id: g.setenta,
				label: 'Setenta · Básico',
				style: 'Salsa',
				team: 'Tuesdays',
				ends: ['Abierta']
			}
		]);
		expect(d.counts).toMatchObject({ inCount: 0, outCount: 1 });
	});

	it("gives an editor the group's History, and in group mode reads the group's side", () => {
		const g = group();
		const d = loadOf('u2', g.hammer);
		expect(d.canEdit).toBe(true);
		expect(d.makeMine).toBeNull();
		expect(d.historyHref).toBe(`/salsa/groups/1/history/position/${g.hammer}`);
		const inGroup = loadOf('u2', g.hammer, jar('1'));
		expect(inGroup.inGroupMode).toBe(true);
		// The group's own figures; no type lead in the group's own workspace.
		expect(inGroup.from).toEqual([
			{ id: g.setenta, label: 'Setenta · Básico', style: '', team: null, ends: ['Abierta'] }
		]);
		expect(inGroup.sameAs).toBeNull();
	});

	it("is a 404 for another person's position, a draft's, and another dance's", () => {
		const o = own();
		expect(loadErr('u3', o.p)).toMatchObject({ status: 404 });
		expect(loadErr('u2', 9999)).toMatchObject({ status: 404 });
		expect(loadErr('u2', o.p, 'bachata')).toMatchObject({ status: 404 });
		const bachata = addPosition(db, U1_BACHATA, 'Closed');
		expect(loadErr('u1', bachata)).toMatchObject({ status: 404 });
		// A group position no published lesson reaches: nobody but its editors.
		const draft = addPosition(db, T1_SALSA, 'Cuddle');
		expect(loadErr('u3', draft)).toMatchObject({ status: 404 });
	});
});

describe('update', () => {
	it('writes the fields of an own position', async () => {
		const p = addPosition(db, U2_SALSA, 'Cerrada');
		const r = await act('update', 'u2', p, fields({ frame: 'closed' }));
		expect(r).toEqual({ action: 'update', ok: true });
		expect(db.select().from(positions).where(eq(positions.id, p)).get()).toMatchObject({
			name: 'Manos cruzadas',
			styleTag: 'son',
			hands: 'two',
			crossed: true,
			facing: 'face',
			frame: 'closed',
			notes: 'Right on top.'
		});
	});

	it('refuses a taken name under the field, and an empty one, writing nothing', async () => {
		const p = addPosition(db, U2_SALSA, 'Cerrada');
		addPosition(db, U2_SALSA, 'Abierta');
		const r = await act('update', 'u2', p, fields({ name: 'ABIERTA' }));
		expect(r).toMatchObject({
			status: 400,
			data: {
				action: 'update',
				field: 'name',
				message: 'You already have a position called ABIERTA.',
				name: 'ABIERTA'
			}
		});
		expect(await act('update', 'u2', p, fields({ name: ' ' }))).toMatchObject({
			status: 400,
			data: { field: 'name', message: 'Give it a name.' }
		});
		expect(db.select().from(positions).where(eq(positions.id, p)).get()?.name).toBe('Cerrada');
	});

	it("writes a group's position with seen and logs the editor; a stale seen is the clash", async () => {
		const g = group();
		const seen = JSON.stringify(positionSeen(db, g.hammer));
		const r = await act('update', 'u2', g.hammer, fields({ name: 'Hammerlock', seen }));
		expect(r).toEqual({ action: 'update', ok: true });
		const log = db
			.select()
			.from(teamChanges)
			.where(and(eq(teamChanges.rootKind, 'position'), eq(teamChanges.verb, 'change')))
			.all();
		expect(log).toMatchObject([{ actorId: 'u2', teamId: 1, rootId: g.hammer }]);

		// The same old seen again: what it saw is no longer there.
		const stale = await act('update', 'u2', g.hammer, fields({ name: 'Other', seen }));
		expect(stale).toMatchObject({ status: 409, data: { action: 'update' } });
		expect(stale.data.clash.changed).toEqual(
			expect.arrayContaining(['styleTag', 'hands', 'crossed', 'facing', 'notes'])
		);
		// Without seen, a group's save is refused.
		expect(await act('update', 'u2', g.hammer, fields({ name: 'Other' }))).toMatchObject({
			status: 400,
			data: { action: 'update' }
		});
		expect(db.select().from(positions).where(eq(positions.id, g.hammer)).get()?.name).toBe(
			'Hammerlock'
		);
		expect(crossRefs(db)).toEqual([]);
	});

	it("is a 404 for a member who only reads it, and for another person's", async () => {
		const g = group();
		const seen = JSON.stringify(positionSeen(db, g.hammer));
		expect(await act('update', 'u3', g.hammer, fields({ seen }))).toMatchObject({ status: 404 });
		const mine = addPosition(db, U2_SALSA, 'Mine');
		expect(await act('update', 'u3', mine, fields())).toMatchObject({ status: 404 });
		expect(await act('archive', 'u3', mine)).toMatchObject({ status: 404 });
		expect(db.select().from(positions).where(eq(positions.id, mine)).get()).toMatchObject({
			name: 'Mine',
			archivedAt: null
		});
	});
});

describe('archive and restore', () => {
	it('archives, answers a second archive the same, shows it archived, then restores', async () => {
		const o = own();
		expect(await act('archive', 'u2', o.p)).toEqual({ action: 'archive', ok: true });
		const row = () => db.select().from(positions).where(eq(positions.id, o.p)).get()!;
		const at = row().archivedAt;
		expect(at).not.toBeNull();
		// A replay changes nothing and answers the same.
		expect(await act('archive', 'u2', o.p)).toEqual({ action: 'archive', ok: true });
		expect(row().archivedAt).toBe(at);
		// Its page still opens, for Restore; nothing reads it in the graph.
		const d = loadOf('u2', o.p);
		expect(d.position.archived).toBe(true);
		expect(d.from).toEqual([]);
		expect(d.seen).toBeNull();
		// A save from an edit sheet left open is told it is gone.
		expect(await act('update', 'u2', o.p, fields())).toMatchObject({ status: 410 });

		expect(await act('restore', 'u2', o.p)).toEqual({ action: 'restore', ok: true });
		expect(row().archivedAt).toBeNull();
		expect(await act('restore', 'u2', o.p)).toEqual({ action: 'restore', ok: true });
		expect(loadOf('u2', o.p).from).toHaveLength(2);
	});

	it('refuses a restore whose name a live position took since', async () => {
		const p = addPosition(db, U2_SALSA, 'Cerrada');
		await act('archive', 'u2', p);
		addPosition(db, U2_SALSA, 'cerrada');
		expect(await act('restore', 'u2', p)).toMatchObject({
			status: 409,
			data: { action: 'restore', message: 'You already have a position called Cerrada.' }
		});
		expect(db.select().from(positions).where(eq(positions.id, p)).get()?.archivedAt).not.toBeNull();
	});

	it("logs a group's archive and restore with the editor", async () => {
		const g = group();
		await act('archive', 'u2', g.hammer);
		await act('restore', 'u2', g.hammer);
		const verbs = db
			.select()
			.from(teamChanges)
			.where(eq(teamChanges.rootKind, 'position'))
			.all()
			.filter((c) => c.rootId === g.hammer)
			.map((c) => [c.verb, c.actorId]);
		expect(verbs).toEqual([
			['archive', 'u2'],
			['restore', 'u2']
		]);
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('Make it mine', () => {
	it("gives a reader their own copy and opens it; an editor's Edit is not this", async () => {
		const g = group();
		const r = await act('makeMine', 'u3', g.hammer);
		const copy = db
			.select()
			.from(positions)
			.all()
			.find((p) => p.userId === 'u3')!;
		expect(copy).toMatchObject({ name: 'Hammerlock', styleTag: 'salsa', teamId: null });
		expect(r).toMatchObject({ status: 303, location: `/salsa/positions/${copy.id}` });
		expect(crossRefs(db)).toEqual([]);
	});
});

describe('New move from a position (ruling 8)', () => {
	async function create(user: string, extra: Record<string, string>, cookies: Cookies = jar()) {
		try {
			return await (figureList.create as (e: unknown) => unknown)({
				params: { dance: 'salsa' },
				locals: locals(user),
				cookies,
				request: body({
					figureName: 'Caída out',
					name: 'Basic',
					partner: 'partner',
					style: 'salsa',
					notes: '',
					...extra
				}),
				url: new URL('http://x/salsa/figures')
			});
		} catch (e) {
			return e as any;
		}
	}
	const made = () =>
		db
			.select()
			.from(figures)
			.all()
			.filter((f) => f.name === 'Basic');

	it('the list presets the sheet with a position the person may tag with, and nothing else', () => {
		const caida = addPosition(db, U2_SALSA, 'Caída');
		const at = (user: string, search: string, cookies: Cookies = jar()) =>
			(figureLoad as (e: unknown) => any)({
				params: { dance: 'salsa' },
				locals: locals(user),
				cookies,
				url: new URL(`http://x/salsa/figures${search}`)
			}).preset;
		expect(at('u2', `?new=1&start=${caida}`)).toEqual({ side: 'start', id: caida, name: 'Caída' });
		expect(at('u2', `?new=1&end=${caida}`)).toEqual({ side: 'end', id: caida, name: 'Caída' });
		expect(at('u2', '?new=1')).toBeNull();
		expect(at('u3', `?new=1&start=${caida}`)).toBeNull();
		// A group's position: the group's own in group mode; not in Mine for an editor who uses none.
		const g = group();
		expect(at('u2', `?new=1&start=${g.hammer}`, jar('1'))).toMatchObject({ id: g.hammer });
		expect(at('u2', `?new=1&start=${g.hammer}`)).toBeNull();
		// u3 added the lesson that reaches it: theirs to use.
		expect(at('u3', `?new=1&start=${g.hammer}`)).toMatchObject({ id: g.hammer });
	});

	it('tags the new figure to start in it, or to end in it', async () => {
		const caida = addPosition(db, U2_SALSA, 'Caída');
		const r = await create('u2', { start: String(caida) });
		const [f] = made();
		expect(r).toMatchObject({ status: 303, location: `/salsa/figures/${f.id}` });
		expect(db.select().from(figureStartPositions).all()).toMatchObject([
			{ figureId: f.id, positionId: caida }
		]);
		expect(db.select().from(figureEndPositions).all()).toEqual([]);

		await create('u2', { figureName: 'Into it', end: String(caida) });
		const into = made().find((x) => x.id !== f.id)!;
		expect(db.select().from(figureEndPositions).all()).toMatchObject([
			{ figureId: into.id, positionId: caida }
		]);
		expect(db.select().from(figureStartPositions).all()).toHaveLength(1);
	});

	it("refuses another person's position, writing nothing", async () => {
		const theirs = addPosition(db, U2_SALSA, 'Caída');
		const r = await create('u3', { start: String(theirs) });
		expect(r).toMatchObject({
			status: 400,
			data: { message: PRESET_GONE, presetGone: true, figureName: 'Caída out' }
		});
		expect(made()).toEqual([]);
		expect(db.select().from(figureStartPositions).all()).toEqual([]);
	});

	it("tags a group's figure with the group's position in group mode", async () => {
		const g = group();
		const r = await create('u2', { start: String(g.hammer) }, jar('1'));
		const [f] = made();
		expect(f).toMatchObject({ teamId: 1, userId: null });
		expect(r).toMatchObject({ status: 303 });
		expect(
			db.select().from(figureStartPositions).where(eq(figureStartPositions.figureId, f.id)).all()
		).toMatchObject([{ figureId: f.id, positionId: g.hammer }]);
		expect(crossRefs(db)).toEqual([]);
		// History shows the starting position, in the editor's name, after the add.
		const lines = db
			.select()
			.from(teamChanges)
			.all()
			.filter((c) => c.rootKind === 'figure' && c.rootId === f.groupId);
		expect(lines.map((c) => [c.verb, c.subject, c.actorId])).toEqual([
			['add', expect.any(String), 'u2'],
			['change', 'startIds', 'u2']
		]);
		expect(JSON.parse(lines[1].afterJson!)).toMatchObject({ startIds: String(g.hammer) });
		expect(JSON.parse(lines[1].beforeJson!)).toMatchObject({ startIds: '' });
	});
});

describe('Video and Lessons: links from the page', () => {
	/** A lesson in `space` with one video, a named section and an unnamed point on it. */
	// `by` is who History names in a group (u1 owns it); a person's own ignore it.
	function taped(space: Space, title: string, day = '2026-11-03') {
		const lesson = createLesson(db, space, { lessonDay: day, title, notes: null }).lesson.id;
		const video = addLessonVideo(
			db,
			{ lessonId: lesson, file: `${title}.mp4`, mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		).id;
		const section = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 72_000, endMs: 91_000, label: 'The cross on 7' },
			'u1'
		)!.id;
		const point = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 72_000, endMs: null, label: null },
			'u1'
		)!.id;
		return { lesson, video, section, point };
	}
	/** A point on a new video of an existing lesson. */
	function pointOn(lessonId: number, startMs = 48_000) {
		const video = addLessonVideo(
			db,
			{ lessonId, file: `v${lessonId}-${startMs}.mp4`, mime: 'video/mp4', sizeBytes: 1 },
			'u1'
		).id;
		return addSpot(db, { lessonVideoId: video }, { startMs, endMs: null, label: null }, 'u1')!.id;
	}
	const links = () => db.select().from(spotPositionLinks).all();
	const handLinks = () =>
		db
			.select({ lessonId: lessonPositions.lessonId, positionId: lessonPositions.positionId })
			.from(lessonPositions)
			.all();
	const U1: Space = { userId: 'u1', dance: 'salsa' };
	const U3: Space = { userId: 'u3', dance: 'salsa' };

	it('reads the cards, the lessons (by hand and through a point) and what an editor may link', () => {
		const o = own();
		const week6 = taped(U2_SALSA, 'Week 6');
		const cubana = taped(U2_SALSA, 'Cubana class', '2026-10-13');
		linkSpotToPosition(db, 'u2', week6.section, o.p);
		const pointLink = linkSpotToPosition(db, 'u2', week6.point, o.p);
		db.insert(lessonPositions).values({ lessonId: cubana.lesson, positionId: o.p }).run();
		const d = loadOf('u2', o.p);
		expect(d.spots.map((s: any) => [s.spot.id, s.point, s.canUnlink])).toEqual([
			[week6.section, false, true],
			[week6.point, true, true]
		]);
		expect(d.picture).toMatchObject({ linkId: pointLink, point: true });
		// Week 6 through its section and point, Cubana by hand: newest class first.
		expect(d.lessons).toEqual([
			{
				id: week6.lesson,
				title: 'Week 6',
				lessonDay: '2026-11-03',
				teamName: null,
				byHand: false,
				via: true,
				viaSections: [
					{ spotId: week6.section, startMs: 72_000, endMs: 91_000, label: 'The cross on 7' },
					{ spotId: week6.point, startMs: 72_000, endMs: null, label: null }
				],
				canUnlink: true
			},
			{
				id: cubana.lesson,
				title: 'Cubana class',
				lessonDay: '2026-10-13',
				teamName: null,
				byHand: true,
				via: false,
				viaSections: [],
				canUnlink: true
			}
		]);
		// The picker: every section and point of u2's videos, the linked ones marked.
		expect(d.linkable.flatMap((g: any) => g.sections.map((s: any) => [s.id, s.linked]))).toEqual(
			expect.arrayContaining([
				[week6.section, true],
				[week6.point, true],
				[cubana.section, false],
				[cubana.point, false]
			])
		);
		expect(d.linkableLessons).toEqual([
			{
				id: week6.lesson,
				title: 'Week 6',
				lessonDay: '2026-11-03',
				videos: 1,
				team: null,
				linked: true,
				via: true
			},
			{
				id: cubana.lesson,
				title: 'Cubana class',
				lessonDay: '2026-10-13',
				videos: 1,
				team: null,
				linked: true,
				via: false
			}
		]);
	});

	it("names the picker's videos by their place: a lesson's video by number, a recording by its day", () => {
		const o = own();
		const week6 = taped(U2_SALSA, 'Week 6');
		const second = pointOn(week6.lesson);
		const kentucky = figure(U2_SALSA, 'Rumba', 'Uno');
		// 23:30 UTC on 25 Oct is 00:30 on 26 Oct in Ljubljana: the person's day.
		const rec = db
			.insert(recordings)
			.values({
				figureId: kentucky,
				file: 'k.mp4',
				mime: 'video/mp4',
				kind: 'video',
				sizeBytes: 1,
				createdAt: Date.UTC(2026, 9, 25, 23, 30)
			})
			.returning()
			.get().id;
		db.insert(videoSpots).values({ recordingId: rec, startMs: 8_000, endMs: 20_000 }).run();
		const d = loadOf('u2', o.p);
		const secondVideo = d.linkable.find((g: any) => g.sections.some((s: any) => s.id === second))
			.video.owner.lessonVideoId;
		expect(d.videoPlaces).toEqual({
			[`v${week6.video}`]: { n: 1 },
			[`v${secondVideo}`]: { n: 2 },
			[`r${rec}`]: { day: '2026-10-26' }
		});
		expect(d.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("offers a reader of a group's position nothing to link and nothing to unlink", () => {
		const g = group();
		const point = pointOn(g.lesson);
		linkSpotToPosition(db, 'u1', point, g.hammer);
		const d = loadOf('u3', g.hammer);
		expect(d.spots.map((s: any) => [s.spot.id, s.canUnlink])).toEqual([[point, false]]);
		expect(loadOf('u2', g.hammer).spots.map((s: any) => s.canUnlink)).toEqual([true]);
		expect(d.lessons).toMatchObject([
			{ id: g.lesson, teamName: 'Tuesdays', via: true, canUnlink: false }
		]);
		expect(d.linkable).toEqual([]);
		expect(d.linkableLessons).toEqual([]);
		// Its editor gets the group's lessons to link, named with the group.
		expect(loadOf('u2', g.hammer).linkableLessons).toMatchObject([
			{ id: g.lesson, team: 'Tuesdays', linked: true, via: true }
		]);
	});

	it("lets a reader edit their own spot on a group's position, not the group's", () => {
		const g = group();
		const point = pointOn(g.lesson);
		linkSpotToPosition(db, 'u1', point, g.hammer);
		const mine = taped(U3, 'My notes');
		linkSpotToPosition(db, 'u3', mine.section, g.hammer);
		const d = loadOf('u3', g.hammer);
		expect(d.canEdit).toBe(false);
		expect(d.spots.map((s: any) => [s.spot.id, s.canEdit, s.canUnlink])).toEqual(
			expect.arrayContaining([
				[point, false, false],
				[mine.section, true, true]
			])
		);
		expect(d.spots).toHaveLength(2);
	});

	it('links a point and a section; refuses a duplicate and a spot of another owner', async () => {
		const o = own();
		const t = taped(U2_SALSA, 'Week 6');
		expect(await act('linkSpot', 'u2', o.p, { spotId: String(t.point) })).toEqual({
			action: 'linkSpot',
			ok: true
		});
		expect(await act('linkSpot', 'u2', o.p, { spotId: String(t.section) })).toEqual({
			action: 'linkSpot',
			ok: true
		});
		expect(links().map((l) => [l.spotId, l.positionId])).toEqual([
			[t.point, o.p],
			[t.section, o.p]
		]);
		expect(await act('linkSpot', 'u2', o.p, { spotId: String(t.point) })).toMatchObject({
			status: 409,
			data: { action: 'linkSpot', message: 'Already linked.' }
		});
		// The group's point (u2 edits it) may not link u2's own position.
		const theirs = taped(T1_SALSA, 'Week 7');
		expect(await act('linkSpot', 'u2', o.p, { spotId: String(theirs.point) })).toMatchObject({
			status: 400,
			data: { action: 'linkSpot', message: 'No such position.' }
		});
		// u1's own point: not u2's to change.
		const strangers = taped(U1, 'Elsewhere');
		expect(await act('linkSpot', 'u2', o.p, { spotId: String(strangers.point) })).toMatchObject({
			status: 400,
			data: { message: 'No such section.' }
		});
		// u3 cannot read u2's position at all.
		expect(await act('linkSpot', 'u3', o.p, { spotId: String(t.point) })).toMatchObject({
			status: 404
		});
		expect(links()).toHaveLength(2);
		expect(crossRefs(db)).toEqual([]);
	});

	it("unlinks; a group's unlink lands in Recently deleted; nobody unlinks what they cannot edit", async () => {
		const o = own();
		const t = taped(U2_SALSA, 'Week 6');
		const mine = linkSpotToPosition(db, 'u2', t.point, o.p);
		expect(await act('unlinkSpot', 'u2', o.p, { linkId: String(mine) })).toEqual({
			action: 'unlinkSpot',
			ok: true
		});
		expect(links()).toEqual([]);
		expect(db.select().from(teamTrash).all()).toEqual([]);

		// The group's Hammerlock and a point on its Week 6: u2 edits, u3 only reads.
		const g = group();
		const theirs = linkSpotToPosition(db, 'u1', pointOn(g.lesson), g.hammer);
		expect(await act('unlinkSpot', 'u3', g.hammer, { linkId: String(theirs) })).toMatchObject({
			status: 404
		});
		// Another position's link, posted to this page: refused too.
		const other = addPosition(db, U2_SALSA, 'Abrazo');
		const elsewhere = linkSpotToPosition(db, 'u2', t.point, other);
		expect(await act('unlinkSpot', 'u2', o.p, { linkId: String(elsewhere) })).toMatchObject({
			status: 404,
			data: { action: 'unlinkSpot' }
		});
		expect(links()).toHaveLength(2);

		expect(await act('unlinkSpot', 'u2', g.hammer, { linkId: String(theirs) })).toEqual({
			action: 'unlinkSpot',
			ok: true
		});
		expect(links().map((l) => l.id)).toEqual([elsewhere]);
		expect(db.select().from(teamTrash).all()).toMatchObject([
			{ teamId: 1, kind: 'position-link', deletedBy: 'u2' }
		]);
	});

	it("links a lesson the person edits; refuses another person's lesson and a reader's", async () => {
		const o = own();
		const t = taped(U2_SALSA, 'Week 6');
		expect(await act('linkLesson', 'u2', o.p, { lessonId: String(t.lesson) })).toEqual({
			action: 'linkLesson',
			ok: true
		});
		expect(handLinks()).toEqual([{ lessonId: t.lesson, positionId: o.p }]);
		expect(await act('linkLesson', 'u2', o.p, { lessonId: String(t.lesson) })).toMatchObject({
			status: 409,
			data: { action: 'linkLesson', message: 'Already linked.' }
		});

		// u1's own lesson: the stranger's 404, nothing written.
		const strangers = createLesson(db, U1, {
			lessonDay: '2026-11-01',
			title: 'Not yours',
			notes: null
		}).lesson.id;
		expect(await act('linkLesson', 'u2', o.p, { lessonId: String(strangers) })).toMatchObject({
			status: 404
		});
		// The group's published lesson: u3 reads it, so it is not theirs to change.
		const g = group();
		expect(await act('linkLesson', 'u3', g.hammer, { lessonId: String(g.lesson) })).toMatchObject({
			status: 404
		});
		// The group's lesson, which u2 edits, may not link u2's own position.
		expect(await act('linkLesson', 'u2', o.p, { lessonId: String(g.lesson) })).toMatchObject({
			status: 400,
			data: { action: 'linkLesson' }
		});
		expect(handLinks()).toEqual([{ lessonId: t.lesson, positionId: o.p }]);
		expect(crossRefs(db)).toEqual([]);
	});

	it("links a person's own lesson to a group position they may use, and the group's lesson as its editor", async () => {
		const g = group();
		const mine = createLesson(db, U3, {
			lessonDay: '2026-11-04',
			title: 'My notes',
			notes: null
		}).lesson.id;
		expect(await act('linkLesson', 'u3', g.hammer, { lessonId: String(mine) })).toEqual({
			action: 'linkLesson',
			ok: true
		});
		expect(await act('linkLesson', 'u2', g.hammer, { lessonId: String(g.lesson) })).toEqual({
			action: 'linkLesson',
			ok: true
		});
		expect(handLinks()).toEqual(
			expect.arrayContaining([
				{ lessonId: mine, positionId: g.hammer },
				{ lessonId: g.lesson, positionId: g.hammer }
			])
		);
		expect(handLinks()).toHaveLength(2);
		expect(db.select().from(teamChanges).all().at(-1)).toMatchObject({
			actorId: 'u2',
			verb: 'add'
		});
		expect(crossRefs(db)).toEqual([]);
	});

	it('an archived position refuses every link change, writing nothing', async () => {
		const o = own();
		const t = taped(U2_SALSA, 'Week 6');
		const link = linkSpotToPosition(db, 'u2', t.point, o.p);
		db.insert(lessonPositions).values({ lessonId: t.lesson, positionId: o.p }).run();
		db.update(positions).set({ archivedAt: 1 }).where(eq(positions.id, o.p)).run();
		const refused = (action: Name) => ({
			status: 400,
			data: { action, message: ARCHIVED_LINKS }
		});
		expect(await act('linkSpot', 'u2', o.p, { spotId: String(t.section) })).toMatchObject(
			refused('linkSpot')
		);
		expect(await act('unlinkSpot', 'u2', o.p, { linkId: String(link) })).toMatchObject(
			refused('unlinkSpot')
		);
		const other = createLesson(db, U2_SALSA, {
			lessonDay: '2026-11-04',
			title: 'Week 7',
			notes: null
		}).lesson.id;
		expect(await act('linkLesson', 'u2', o.p, { lessonId: String(other) })).toMatchObject(
			refused('linkLesson')
		);
		const via = { lessonId: String(t.lesson), alsoSections: '1' };
		expect(await act('unlinkLesson', 'u2', o.p, via)).toMatchObject(refused('unlinkLesson'));
		expect(links().map((l) => [l.spotId, l.positionId])).toEqual([[t.point, o.p]]);
		expect(handLinks()).toEqual([{ lessonId: t.lesson, positionId: o.p }]);
	});

	it('refuses to link an archived lesson, writing nothing', async () => {
		const o = own();
		const t = taped(U2_SALSA, 'Week 6');
		db.update(lessons).set({ archivedAt: 1 }).where(eq(lessons.id, t.lesson)).run();
		expect(await act('linkLesson', 'u2', o.p, { lessonId: String(t.lesson) })).toMatchObject({
			status: 400,
			data: { action: 'linkLesson', message: 'That lesson is archived.' }
		});
		expect(handLinks()).toEqual([]);
	});

	it('unlinks a lesson by hand, and one there through a point with its links', async () => {
		const o = own();
		const t = taped(U2_SALSA, 'Week 6');
		db.insert(lessonPositions).values({ lessonId: t.lesson, positionId: o.p }).run();
		expect(await act('unlinkLesson', 'u2', o.p, { lessonId: String(t.lesson) })).toEqual({
			action: 'unlinkLesson',
			ok: true
		});
		expect(handLinks()).toEqual([]);
		linkSpotToPosition(db, 'u2', t.point, o.p);
		const via = { lessonId: String(t.lesson), alsoSections: '1' };
		expect(await act('unlinkLesson', 'u3', o.p, via)).toMatchObject({ status: 404 });
		expect(links()).toHaveLength(1);
		expect(await act('unlinkLesson', 'u2', o.p, via)).toEqual({
			action: 'unlinkLesson',
			ok: true
		});
		expect(links()).toEqual([]);
		expect(await act('unlinkLesson', 'u2', o.p, via)).toMatchObject({
			status: 400,
			data: { action: 'unlinkLesson' }
		});
	});
});
