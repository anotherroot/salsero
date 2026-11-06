/**
 * A group's page: the member's "Add new lessons to Today automatically"
 * switch (drawn at the two upper levels) and the one-tap Add below
 * Everything (`addNow`: the default picks, no sheet). The database is
 * mocked, never set through `process.env` (see CLAUDE.md).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { lessonAdds, teamMembers } from '$lib/server/db/schema';
import { CLASS_ED, OTHER_ED, makeClass, type Class } from '$lib/server/test-class';
import { createLesson, linkExercise, publishLesson } from '$lib/server/lessons';
import { entryFor } from '$lib/server/entries';
import { setLevel } from '$lib/server/levels';
import type { Level } from '$lib/levels/levels';
import { actions, load } from './+page.server';

let db: Db;
let c: Class;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	c = makeClass(db);
});

const user = (id: string, level: Level | null = 'all') => ({
	id,
	email: `${id}@x.si`,
	timezone: 'Europe/Ljubljana',
	level
});

type Act = (e: unknown) => Promise<{ status?: number; data?: { message?: string } } | never>;
async function post(
	name: 'autoAdd' | 'addNow',
	as: string,
	fields: Record<string, string>,
	group = '1'
) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.append(k, v);
	try {
		return await (actions[name] as unknown as Act)({
			params: { dance: 'salsa', id: group },
			locals: { user: user(as) },
			request: new Request(`http://localhost/salsa/groups/${group}?/${name}`, {
				method: 'POST',
				body
			})
		});
	} catch (thrown) {
		return thrown as { status?: number };
	}
}

type Loaded = { autoAdd: { on: boolean } | null; addAtOnce: boolean };
const loadAs = (id: string, level: Level | null) =>
	(load as unknown as (e: unknown) => Loaded)({
		params: { dance: 'salsa', id: '1' },
		locals: { user: user(id, level) },
		url: new URL('http://localhost/salsa/groups/1')
	});

const stored = (userId: string) =>
	db
		.select({ autoAdd: teamMembers.autoAdd })
		.from(teamMembers)
		.where(and(eq(teamMembers.teamId, 1), eq(teamMembers.userId, userId)))
		.get()?.autoAdd;

describe('the switch', () => {
	it('is drawn at the two upper levels, on by default only below Everything', () => {
		expect(loadAs('u3', 'follow')).toMatchObject({ autoAdd: null, addAtOnce: true });
		expect(loadAs('u3', 'own')).toMatchObject({ autoAdd: { on: true }, addAtOnce: true });
		expect(loadAs('u3', 'all')).toMatchObject({ autoAdd: { on: false }, addAtOnce: false });
		// Not chosen yet: drawn as Everything.
		expect(loadAs('u3', null)).toMatchObject({ autoAdd: { on: false }, addAtOnce: false });
	});

	it('autoAdd stores the member’s own choice, which the page then shows', async () => {
		expect(await post('autoAdd', 'u3', { on: '1' })).toMatchObject({ action: 'autoAdd', ok: true });
		expect(stored('u3')).toBe(1);
		expect(loadAs('u3', 'all').autoAdd).toEqual({ on: true });
		await post('autoAdd', 'u3', { on: '0' });
		expect(stored('u3')).toBe(0);
		expect(loadAs('u3', 'own').autoAdd).toEqual({ on: false });
	});

	it('refuses anything but 1 or 0, and a stranger', async () => {
		expect(await post('autoAdd', 'u3', { on: 'yes' })).toMatchObject({ status: 400 });
		expect(stored('u3')).toBeNull();
		expect(await post('autoAdd', 'u4', { on: '1' })).toMatchObject({ status: 404 });
	});

	it('turning it on adds nothing by itself: it applies from the next publish', async () => {
		const before = createLesson(db, CLASS_ED, {
			lessonDay: '2026-10-25',
			title: 'Before',
			notes: null
		}).lesson.id;
		expect(publishLesson(db, CLASS_ED, before, 1)).toBe(true);
		await post('autoAdd', 'u3', { on: '1' });
		expect(entryFor(db, 'u3', { lessonId: before })).toBeNull();
		const after = createLesson(db, CLASS_ED, {
			lessonDay: '2026-10-26',
			title: 'After',
			notes: null
		}).lesson.id;
		expect(publishLesson(db, CLASS_ED, after, 2)).toBe(true);
		expect(entryFor(db, 'u3', { lessonId: after })).not.toBeNull();
	});
});

describe('addNow', () => {
	let next: number;
	beforeEach(() => {
		next = createLesson(db, CLASS_ED, { lessonDay: '2026-11-08', title: 'Next', notes: null })
			.lesson.id;
		linkExercise(db, next, c.drill, 'u2');
		expect(publishLesson(db, CLASS_ED, next, 5)).toBe(true);
	});

	it('adds the lesson and its drills at once', async () => {
		setLevel(db, 'u3', 'own');
		expect(await post('addNow', 'u3', { lessonId: String(next) })).toMatchObject({
			action: 'addNow',
			ok: true
		});
		expect(entryFor(db, 'u3', { lessonId: next })).toMatchObject({ archivedAt: null });
		expect(
			db
				.select()
				.from(lessonAdds)
				.where(and(eq(lessonAdds.userId, 'u3'), eq(lessonAdds.lessonId, next)))
				.all()
		).toHaveLength(1);
	});

	it('refuses a draft, another group’s lesson and a stranger, with a message', async () => {
		const draft = createLesson(db, CLASS_ED, {
			lessonDay: '2026-11-09',
			title: 'Draft',
			notes: null
		}).lesson.id;
		expect(await post('addNow', 'u3', { lessonId: String(draft) })).toMatchObject({
			status: 404,
			data: { message: 'No such lesson' }
		});
		const theirs = createLesson(db, OTHER_ED, { lessonDay: '2026-11-09', title: 'X', notes: null })
			.lesson.id;
		publishLesson(db, OTHER_ED, theirs, 5);
		expect(await post('addNow', 'u3', { lessonId: String(theirs) })).toMatchObject({
			status: 404
		});
		expect(await post('addNow', 'u3', {})).toMatchObject({ status: 404 });
		expect(await post('addNow', 'u4', { lessonId: String(next) })).toMatchObject({ status: 404 });
		expect(entryFor(db, 'u3', { lessonId: draft })).toBeNull();
	});
});
