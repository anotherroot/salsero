/**
 * A figure's switcher (the phone's bottom bar, the desktop's tabs) steps through
 * the move as the Figures list shows it: the person's own move and the added
 * groups' moves of the same name are one, each group figure marked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import type { Cookies } from '@sveltejs/kit';
import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { addLesson } from '$lib/server/entries';
import { createTeam, joinTeam } from '$lib/server/teams';
import { createLesson, linkFigure, publishLesson } from '$lib/server/lessons';
import { createFigure, createVariationIn } from '$lib/server/figures';
import { T1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { groupCookie } from '$lib/teams/mode';
import * as figurePage from './(moves)/figures/[id]/+page.server';

const T = Date.UTC(2026, 10, 3, 20);
let db: Db;

const open = (uid: string, id: number, groupMode?: string) =>
	(figurePage.load as (e: unknown) => unknown)({
		params: { dance: 'salsa', id: String(id) },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } },
		cookies: {
			get: (n: string) => (n === groupCookie('salsa') ? groupMode : undefined),
			set: () => {},
			delete: () => {}
		} as unknown as Cookies,
		url: new URL(`http://localhost/salsa/figures/${id}`)
	}) as {
		siblings: { id: number; name: string; team: { name: string } | null }[];
		lastInMove: boolean;
	};
const FIG = { partner: 'partner', style: 'salsa', notes: null } as const;
const figureIn = (space: typeof T1_SALSA | typeof U2_SALSA, move: string, name: string) =>
	createFigure(db, space, { ...FIG, figureName: move, name })!;

let basic: number, vuelta: number, doble: number, other: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Tuesdays', T);
	joinTeam(db, 'u2', 1, T);

	// u2's own Enchufla: Basic and Con vuelta.
	const mine = figureIn(U2_SALSA, 'Enchufla', 'Basic');
	basic = mine.figure.id;
	vuelta = createVariationIn(db, mine.group.id, { ...FIG, name: 'Con vuelta' })!.id;
	// The group's Enchufla (another case, as typed in class) and a move u2 has none of.
	doble = figureIn(T1_SALSA, 'enchufla ', 'Doble').figure.id;
	other = figureIn(T1_SALSA, 'Setenta', 'Basic').figure.id;
	const L = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'Week 4', notes: null })
		.lesson.id;
	linkFigure(db, L, doble, 'u1');
	linkFigure(db, L, other, 'u1');
	publishLesson(db, T1_SALSA, L, T);
	addLesson(db, 'u2', L, { lesson: true, routineIds: [], drillIds: [], figureIds: [] }, T);
});

const steps = (d: ReturnType<typeof open>) => d.siblings.map((s) => [s.name, s.team?.name ?? null]);

describe('the switcher of a merged move', () => {
	it("on your own figure: yours, then the group's of the same name, marked", () => {
		const d = open('u2', basic);
		expect(steps(d)).toEqual([
			['Basic', null],
			['Con vuelta', null],
			['Doble', 'Tuesdays']
		]);
		expect(d.lastInMove).toBe(false);
	});

	it("on the group's figure: the same list, yours included", () => {
		const d = open('u2', doble);
		expect(steps(d)).toEqual([
			['Basic', null],
			['Con vuelta', null],
			['Doble', 'Tuesdays']
		]);
		// Archiving it would archive the group's move: it is the only one there.
		expect(d.lastInMove).toBe(true);
	});

	it("a group's move with no own namesake keeps to itself", () => {
		expect(steps(open('u2', other))).toEqual([['Basic', 'Tuesdays']]);
	});

	it('in group mode the move is the group’s alone, unmarked', () => {
		expect(steps(open('u1', doble, '1'))).toEqual([['Doble', null]]);
		expect(steps(open('u1', other, '1'))).toEqual([['Basic', null]]);
	});

	it('the variation order is the list’s even when the opened one sits last', () => {
		expect(open('u2', vuelta).siblings.map((s) => s.id)).toEqual([basic, vuelta, doble]);
	});
});
