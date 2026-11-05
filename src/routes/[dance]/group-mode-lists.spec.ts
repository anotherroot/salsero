/**
 * Group mode on the Moves and Lessons lists: which space a list reads and a
 * create writes in. The cookie is the client's, so every create takes its space
 * from `spaceOf`, which re-checks it.
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
	figureGroups,
	figures,
	lessons,
	routines,
	teamChanges,
	users
} from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { createLesson, linkRoutine, linkFigure } from '$lib/server/lessons';
import { createRoutine } from '$lib/server/routines';
import { createFigure, createVariationIn } from '$lib/server/figures';
import { T1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { groupCookie } from '$lib/teams/mode';
import { actions as figureActions } from './(moves)/figures/+page.server';
import { actions as routineActions } from './(moves)/routines/+page.server';
import { actions as lessonActions, load as lessonsLoad } from './lessons/+page.server';
import { load as coverageLoad } from './(moves)/coverage/+page.server';
import { load as movesListsLoad } from './(moves)/+layout.server';
import { figuresView } from '$lib/moves/filter';
import { positionsView } from '$lib/positions/filter';
import { addPosition } from '$lib/server/test-positions';

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
const locals = (id: string) =>
	({ user: { id, timezone: 'Europe/Ljubljana', role: 'user' } }) as unknown as App.Locals;
const post = (fields: Record<string, string>) =>
	({
		formData: async () => {
			const f = new FormData();
			for (const [k, v] of Object.entries(fields)) f.set(k, v);
			return f;
		}
	}) as unknown as Request;
const call = async (
	fn: unknown,
	user: string,
	cookies: Cookies,
	fields: Record<string, string>
) => {
	try {
		return await (fn as (e: unknown) => unknown)({
			params: { dance: 'salsa' },
			locals: locals(user),
			cookies,
			request: post(fields),
			url: new URL('http://x/salsa')
		});
	} catch (e) {
		return e; // a redirect
	}
};
const loadOf = (fn: unknown, user: string, cookies: Cookies) =>
	(fn as (e: unknown) => unknown)({
		params: { dance: 'salsa' },
		locals: locals(user),
		cookies,
		url: new URL('http://x/salsa')
	}) as never as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// The lists as the pages show them: the layout's unfiltered data through the pure view.
type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const figuresData = (d: Loose) => ({
	...d.lists.figures,
	...figuresView(d.lists.figures, { q: '' })
});
const positionsData = (d: Loose) => ({
	...d.lists.positions,
	...positionsView(d.lists.positions, { q: '' })
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

const FIGURE = {
	figureName: 'Enchufla',
	name: 'Basic',
	partner: 'partner',
	style: 'salsa',
	notes: ''
};
const LESSON = { lessonDay: '2026-11-01', title: 'Class', notes: '' };

describe('creating in group mode', () => {
	it('creates a figure in the group in group mode', async () => {
		await call(figureActions.create, 'u2', jar('1').cookies, FIGURE);
		const g = db.select().from(figureGroups).get()!;
		const v = db.select().from(figures).get()!;
		expect([g.teamId, g.userId, v.teamId, v.userId]).toEqual([1, null, 1, null]);
		const logged = db.select().from(teamChanges).all();
		expect(logged.some((c) => c.actorId === 'u2')).toBe(true);
	});
	it('creates a figure in Mine when the cookie names a group the person only belongs to', async () => {
		const j = jar('1');
		await call(figureActions.create, 'u3', j.cookies, FIGURE);
		const g = db.select().from(figureGroups).get()!;
		expect([g.userId, g.teamId]).toEqual(['u3', null]);
		expect(j.calls.deleted).toBe(1);
	});
	it('creates a routine in the group in group mode, and in Mine for a member', async () => {
		await call(routineActions.create, 'u2', jar('1').cookies, { name: 'R', notes: '' });
		const r = db.select().from(routines).get()!;
		expect([r.teamId, r.userId]).toEqual([1, null]);
		const j = jar('1');
		await call(routineActions.create, 'u3', j.cookies, { name: 'M', notes: '' });
		const m = db.select().from(routines).where(eq(routines.name, 'M')).get()!;
		expect([m.userId, m.teamId]).toEqual(['u3', null]);
		expect(j.calls.deleted).toBe(1);
	});
	it('creates a lesson draft in the group in group mode, and in Mine for a member', async () => {
		await call(lessonActions.create, 'u2', jar('1').cookies, LESSON);
		const l = db.select().from(lessons).get()!;
		expect([l.teamId, l.userId, l.publishedAt]).toEqual([1, null, null]);
		const j = jar('1');
		await call(lessonActions.create, 'u3', j.cookies, { ...LESSON, title: 'Mine', everyDays: '3' });
		const m = db.select().from(lessons).where(eq(lessons.title, 'Mine')).get()!;
		expect([m.userId, m.teamId]).toEqual(['u3', null]);
		expect(j.calls.deleted).toBe(1);
	});
});

describe('listing in group mode', () => {
	it("lists only the group's routines, marking what members don't see", async () => {
		const R = createRoutine(db, T1_SALSA, { name: 'R', notes: null }).routine.id;
		createRoutine(db, T1_SALSA, { name: 'U', notes: null });
		createRoutine(db, U2_SALSA, { name: 'Own', notes: null });
		const P = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'P', notes: null })
			.lesson.id;
		linkRoutine(db, P, R, 'u1');
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, P)).run();
		const data = loadOf(movesListsLoad, 'u2', jar('1').cookies).lists.routines;
		const seen = Object.fromEntries(data.routines.map((r: any) => [r.name, r.membersSee])); // eslint-disable-line @typescript-eslint/no-explicit-any
		expect(seen).toEqual({ R: true, U: false });
		expect(data.groups).toEqual([]);
	});
	it("lists the group's figures with membersSee, and no coverage tile", async () => {
		// A person's figure with two variations first, so a group's figure id and
		// its variation's id never coincide: membersSee must be by variation.
		const own = createFigure(db, U2_SALSA, { ...FIGURE, figureName: 'Own', notes: null } as never)!;
		createVariationIn(db, own.group.id, { ...FIGURE, name: 'Doble', notes: null } as never, 'u2');
		const a = createFigure(db, T1_SALSA, { ...FIGURE, notes: null } as never)!;
		createFigure(db, T1_SALSA, { ...FIGURE, figureName: 'Other', notes: null } as never);
		const other = db.select().from(figures).where(eq(figures.name, 'Basic')).all().at(-1)!;
		expect(a.figure.id).not.toBe(a.group.id);
		expect(other.id).not.toBe(other.groupId);
		expect(other.groupId).toBe(a.figure.id); // the very collision a mix-up would hit
		const P = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'P', notes: null })
			.lesson.id;
		linkFigure(db, P, a.figure.id, 'u1');
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, P)).run();
		const data = figuresData(loadOf(movesListsLoad, 'u2', jar('1').cookies));
		const seen = Object.fromEntries(
			data.figures.map((m: { name: string; figures: { membersSee: boolean }[] }) => [
				m.name,
				m.figures[0].membersSee
			])
		);
		expect(seen).toEqual({ Enchufla: true, Other: false });
		expect(data).not.toHaveProperty('tagged');
		expect(data.unrouted).toBeNull();
		expect(data.groups).toEqual([]);
	});
	it("lists the group's lessons, drafts first, in group mode", async () => {
		createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'Draft', notes: null });
		const data = loadOf(lessonsLoad, 'u2', jar('1').cookies);
		expect(data.lessons.map((l: any) => l.title)).toEqual(['Draft']); // eslint-disable-line @typescript-eslint/no-explicit-any
	});
	it('sends coverage back to figures in group mode', async () => {
		let thrown: any; // eslint-disable-line @typescript-eslint/no-explicit-any
		try {
			loadOf(coverageLoad, 'u2', jar('1').cookies);
		} catch (e) {
			thrown = e;
		}
		expect([thrown?.status, thrown?.location]).toEqual([303, '/salsa/figures']);
	});

	it('positions: counts the group figures and hides the gap report in group mode', () => {
		// Positions are owned: the group's Open and u2's own, one family.
		const ours = addPosition(db, T1_SALSA, 'Open', { geneId: 'open' });
		const yours = addPosition(db, U2_SALSA, 'Open', { geneId: 'open' });
		const g = createFigure(db, T1_SALSA, { ...FIGURE, notes: null } as never)!;
		const own = createFigure(db, U2_SALSA, { ...FIGURE, figureName: 'Own', notes: null } as never)!;
		db.insert(figureEndPositions).values({ figureId: g.figure.id, positionId: ours }).run();
		db.insert(figureEndPositions).values({ figureId: own.figure.id, positionId: yours }).run();
		const row = (d: Record<string, any>, id: number) => d.rows.find((p: any) => p.id === id); // eslint-disable-line
		const inGroup = positionsData(loadOf(movesListsLoad, 'u2', jar('1').cookies));
		expect(inGroup.inGroupMode).toBe(true);
		expect(row(inGroup, ours)).toMatchObject({ inCount: 1, deadEnd: false, orphan: false });
		expect(inGroup.tagged.total).toBe(1);
		const mine = positionsData(loadOf(movesListsLoad, 'u2', jar().cookies));
		expect(mine.inGroupMode).toBe(false);
		expect(row(mine, yours)).toMatchObject({ inCount: 1, deadEnd: true });
	});
});
