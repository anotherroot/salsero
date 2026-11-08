/**
 * A move's page: the load (figures, used in, who may edit) and the rename and
 * new-figure actions, against an in-memory database like the other route specs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { figureGroups, lessons, users } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { createFigure, createVariationIn, listGroupVariations } from '$lib/server/figures';
import { addFigureSlot, createRoutine } from '$lib/server/routines';
import { createLesson, linkFigure } from '$lib/server/lessons';
import { T1_SALSA, U1_SALSA } from '$lib/server/test-walls';
import { runInLocale } from '$lib/server/i18n-request';
import { actions, load } from './+page.server';

const locals = (id: string) =>
	({
		user: { id, timezone: 'Europe/Ljubljana', dance: 'salsa', role: 'user' }
	}) as unknown as App.Locals;
const form = (fields: Record<string, string>) =>
	({
		formData: async () => {
			const f = new FormData();
			for (const [k, v] of Object.entries(fields)) f.set(k, v);
			return f;
		}
	}) as unknown as Request;
const loadAs = (user: string, id: number, dance = 'salsa') =>
	(load as (e: unknown) => any)({ params: { dance, id: String(id) }, locals: locals(user) }); // eslint-disable-line @typescript-eslint/no-explicit-any
const act = async (
	name: 'rename' | 'createFigure',
	user: string,
	id: number,
	f: Record<string, string>
) => {
	try {
		return await (actions[name] as (e: unknown) => unknown)({
			params: { dance: 'salsa', id: String(id) },
			locals: locals(user),
			request: form(f)
		});
	} catch (e) {
		return e;
	}
};

const INPUT = { partner: 'partner' as const, style: 'salsa', notes: null };
let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
});

describe('a move of your own', () => {
	let groupId: number;
	let doble: number;
	let basica: number;
	beforeEach(() => {
		const made = createFigure(db, U1_SALSA, { ...INPUT, figureName: 'Enchufla', name: 'Básica' })!;
		groupId = made.group.id;
		basica = made.figure.id;
		doble = createVariationIn(db, groupId, { ...INPUT, name: 'Doble' })!.id;
		createFigure(db, U1_SALSA, { ...INPUT, figureName: 'Other', name: 'Solo' });
	});

	it('loads its live figures in id order, with the editor flag', () => {
		const data = loadAs('u1', groupId);
		expect(data.move).toEqual({ id: groupId, name: 'Enchufla' });
		expect(data.figures.map((f: { id: number }) => f.id)).toEqual([basica, doble]);
		expect(data.canEdit).toBe(true);
		expect(data.usedIn).toEqual([]);
	});

	it('lists the routines that use it and the lessons that link it', () => {
		const r = createRoutine(db, U1_SALSA, { name: 'Friday', notes: null }).routine.id;
		addFigureSlot(db, r, doble);
		addFigureSlot(db, r, basica);
		const l = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'Class', notes: null })
			.lesson.id;
		linkFigure(db, l, basica);
		expect(loadAs('u1', groupId).usedIn).toEqual([
			{ kind: 'routine', id: r, name: 'Friday', meta: 'Routine · Doble and Básica' },
			{ kind: 'lesson', id: l, name: 'Class', meta: 'Lesson' }
		]);
	});

	it('is a 404 for another person, another dance and an archived move', () => {
		expect(() => loadAs('u2', groupId)).toThrow(expect.objectContaining({ status: 404 }));
		expect(() => loadAs('u1', groupId, 'bachata')).toThrow(
			expect.objectContaining({ status: 404 })
		);
		db.update(figureGroups).set({ archivedAt: 1 }).where(eq(figureGroups.id, groupId)).run();
		expect(() => loadAs('u1', groupId)).toThrow(expect.objectContaining({ status: 404 }));
	});

	it('renames, and refuses a taken name', async () => {
		expect(await act('rename', 'u1', groupId, { name: 'Other' })).toMatchObject({
			status: 400,
			data: { field: 'name', message: "There's already a move called Other.", name: 'Other' }
		});
		expect(await act('rename', 'u1', groupId, { name: 'Enchufla 2' })).toMatchObject({ ok: true });
		expect(loadAs('u1', groupId).move.name).toBe('Enchufla 2');
	});

	it('refuses in Slovenian inside a Slovenian request, the names after a colon', async () => {
		expect(
			await runInLocale('sl', () => act('rename', 'u1', groupId, { name: 'Other' }))
		).toMatchObject({
			data: { message: 'Figura s tem imenom že obstaja: Other.' }
		});
		expect(
			await runInLocale('sl', () => act('rename', 'u1', groupId, { name: ' ' }))
		).toMatchObject({ data: { message: 'Vpišite ime figure (do 200 znakov).' } });
		expect(
			await runInLocale('sl', () => act('createFigure', 'u1', groupId, { name: 'Básica' }))
		).toMatchObject({
			data: {
				message:
					'Različica s tem imenom že obstaja v figuri Enchufla: Básica. Najprej eno preimenujte.'
			}
		});
	});

	it('refuses another person renaming it', async () => {
		expect(await act('rename', 'u2', groupId, { name: 'Mine' })).toMatchObject({ status: 404 });
	});

	it('adds a figure and opens it; refuses a taken name', async () => {
		expect(await act('createFigure', 'u1', groupId, { name: 'Básica' })).toMatchObject({
			status: 400,
			data: { field: 'name' }
		});
		const done = await act('createFigure', 'u1', groupId, { name: 'Triple' });
		expect(done).toMatchObject({ status: 303 });
		expect(listGroupVariations(db, groupId).map((f) => f.name)).toEqual([
			'Básica',
			'Doble',
			'Triple'
		]);
	});
});

describe("a group's move", () => {
	let groupId: number;
	let reached: number;
	beforeEach(() => {
		createTeam(db, 'u1', 'salsa', 'Tuesdays', 1);
		joinTeam(db, 'u2', 1, 2);
		const made = createFigure(db, T1_SALSA, { ...INPUT, figureName: 'Enchufla', name: 'Básica' })!;
		groupId = made.group.id;
		reached = made.figure.id;
		createVariationIn(db, groupId, { ...INPUT, name: 'Draft' }, 'u1');
		const p = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'P', notes: null })
			.lesson.id;
		linkFigure(db, p, reached, 'u1');
		db.update(lessons).set({ publishedAt: 1 }).where(eq(lessons.id, p)).run();
	});

	it('shows a member only the reached figures, read-only', () => {
		const data = loadAs('u2', groupId);
		expect(data.figures.map((f: { id: number }) => f.id)).toEqual([reached]);
		expect(data.canEdit).toBe(false);
		expect(data.usedIn.map((u: { kind: string }) => u.kind)).toEqual(['lesson']);
	});

	it('shows the owner everything, and an outsider nothing', () => {
		expect(loadAs('u1', groupId).figures).toHaveLength(2);
		expect(loadAs('u1', groupId).canEdit).toBe(true);
		expect(() => loadAs('u3', groupId)).toThrow(expect.objectContaining({ status: 404 }));
	});

	it('a member cannot rename or add', async () => {
		expect(await act('rename', 'u2', groupId, { name: 'X' })).toMatchObject({ status: 404 });
		expect(await act('createFigure', 'u2', groupId, { name: 'X' })).toMatchObject({ status: 404 });
	});

	it('a rename without seen is refused; with it, it saves', async () => {
		expect(await act('rename', 'u1', groupId, { name: 'Enchufla 2' })).toMatchObject({
			status: 400
		});
		const seen = JSON.stringify(loadAs('u1', groupId).seen);
		expect(await act('rename', 'u1', groupId, { name: 'Enchufla 2', seen })).toMatchObject({
			ok: true
		});
		// The same stale `seen` again is a clash.
		expect(await act('rename', 'u1', groupId, { name: 'Enchufla 3', seen })).toMatchObject({
			status: 409
		});
	});
});
