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
import { inArray } from 'drizzle-orm';
import { figures, users } from '$lib/server/db/schema';
import { addLesson } from '$lib/server/entries';
import { createTeam, joinTeam } from '$lib/server/teams';
import { createLesson, linkFigure, publishLesson } from '$lib/server/lessons';
import { addRecording, createFigure, createVariationIn } from '$lib/server/figures';
import { T1_SALSA, U1_SALSA, U2_SALSA } from '$lib/server/test-walls';
// The group view is in the address now (`?in=`); a jar only carries the group a test's URL names.
const VIEW = 'view';
import * as figurePage from './(moves)/figures/[id]/+page.server';
import * as movePage from './(moves)/moves/[id]/+page.server';
import { markTwins } from '$lib/server/twins';
import { addLinks } from '$lib/server/links';

const T = Date.UTC(2026, 10, 3, 20);
let db: Db;

const open = (uid: string, id: number, groupMode?: string) =>
	(figurePage.load as (e: unknown) => unknown)({
		params: { dance: 'salsa', id: String(id) },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } },
		cookies: {
			get: (n: string) => (n === VIEW ? groupMode : undefined),
			set: () => {},
			delete: () => {}
		} as unknown as Cookies,
		url: new URL(`http://localhost/salsa/figures/${id}`)
	}) as {
		siblings: {
			id: number;
			name: string;
			team: { name: string } | null;
			copies: number;
			twins: boolean;
			videos: number;
		}[];
		lastInMove: boolean;
		switcherId: number;
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

	// The user's exception (group view spec): in the group's view the switcher is
	// still the merged move, so stepping onto your own figure is possible.
	it('in the group’s view the switcher is still the merged move, the group’s marked', () => {
		expect(steps(open('u1', doble))).toEqual([['Doble', 'Tuesdays']]);
		const own = figureIn(U1_SALSA, 'Enchufla', 'Mine').figure.id;
		expect(steps(open('u1', doble))).toEqual([
			['Mine', null],
			['Doble', 'Tuesdays']
		]);
		expect(own).toBeGreaterThan(0);
	});

	it('the variation order is the list’s even when the opened one sits last', () => {
		expect(open('u2', vuelta).siblings.map((s) => s.id)).toEqual([basic, vuelta, doble]);
	});
});

describe('a figure and its copy', () => {
	// The group's Doble is a copy of a Doble of u2's own: one family (gene).
	let mineDoble: number;
	beforeEach(() => {
		const enchufla = db
			.select()
			.from(figures)
			.where(inArray(figures.id, [basic]))
			.get()!;
		mineDoble = createVariationIn(db, enchufla.groupId!, { ...FIG, name: 'Doble' })!.id;
		db.update(figures)
			.set({ geneId: 'g-doble' })
			.where(inArray(figures.id, [mineDoble, doble]))
			.run();
	});
	const rows = (d: ReturnType<typeof open>) =>
		d.siblings.map((s) => [s.name, s.team?.name ?? null, s.copies]);
	const ONE_ROW = [
		['Basic', null, 0],
		['Con vuelta', null, 0],
		['Doble', null, 1]
	];

	it('on yours: one row for both, marked with its copy', () => {
		const d = open('u2', mineDoble);
		expect(rows(d)).toEqual(ONE_ROW);
		expect(d.switcherId).toBe(mineDoble);
	});

	it("on the group's copy: the same list, your row lit", () => {
		const d = open('u2', doble);
		expect(rows(d)).toEqual(ONE_ROW);
		expect(d.switcherId).toBe(mineDoble);
	});

	it('in group mode the group’s copy is its own row', () => {
		const d = open('u1', doble, '1');
		expect(d.siblings.map((s) => s.name)).toEqual(['Doble']);
		expect(d.switcherId).toBe(doble);
	});
});

describe('twins and what a row holds', () => {
	it('marks the row that stands for its twins', () => {
		// u2's Con vuelta and the group's Doble: Same as…, the group's folded into u2's.
		expect(markTwins(db, U2_SALSA, 'figure', [vuelta, doble])).toBe(true);
		for (const at of [vuelta, doble]) {
			const d = open('u2', at);
			expect(d.siblings.map((s) => [s.name, s.twins])).toEqual([
				['Basic', false],
				['Con vuelta', true]
			]);
			expect(d.switcherId).toBe(vuelta);
		}
	});

	it('counts recordings and links, as its Recordings list does', () => {
		addRecording(db, {
			figureId: vuelta,
			file: 'v.mp4',
			mime: 'video/mp4',
			kind: 'video',
			sizeBytes: 1,
			note: null
		});
		addLinks(db, { figureId: vuelta }, ['https://www.youtube.com/watch?v=abcdefghijk'], null);
		addLinks(db, { figureId: doble }, ['https://www.youtube.com/watch?v=bcdefghijkl'], null, 'u1');
		expect(open('u2', basic).siblings.map((s) => [s.name, s.videos])).toEqual([
			['Basic', 0],
			['Con vuelta', 2],
			['Doble', 1]
		]);
	});
});

describe('the move page', () => {
	const move = (uid: string, id: number, groupMode?: string) =>
		(movePage.load as (e: unknown) => unknown)({
			params: { dance: 'salsa', id: String(id) },
			locals: { user: { id: uid, isAdmin: false, timezone: 'UTC', dance: 'salsa' } },
			cookies: {
				get: (n: string) => (n === VIEW ? groupMode : undefined),
				set: () => {},
				delete: () => {}
			} as unknown as Cookies,
			url: new URL(`http://localhost/salsa/moves/${id}`)
		}) as { figures: { name: string; team: { name: string } | null; copies: number }[] };
	const moveOf = (fid: number) =>
		db
			.select()
			.from(figures)
			.where(inArray(figures.id, [fid]))
			.get()!.groupId!;

	it("lists the move as the Figures list merges it, from yours or the group's", () => {
		for (const at of [basic, doble]) {
			expect(move('u2', moveOf(at)).figures.map((f) => [f.name, f.team?.name ?? null])).toEqual([
				['Basic', null],
				['Con vuelta', null],
				['Doble', 'Tuesdays']
			]);
		}
	});

	it('in group mode the group’s move is its own figures', () => {
		expect(move('u1', moveOf(doble), '1').figures.map((f) => f.name)).toEqual(['Doble']);
	});
});
