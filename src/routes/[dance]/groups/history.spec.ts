/** The History page: its editors' and owner's only, one group's things only, and Restore. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createTeam, joinTeam, setRole } from '$lib/server/teams';
import { createLesson, getLessonRow, updateLesson } from '$lib/server/lessons';
import { createCustomExercise } from '$lib/server/exercises';
import { history } from '$lib/server/changes';
import { T1_SALSA, U1_SALSA } from '$lib/server/test-walls';
import { actions, load } from './[id]/history/[kind]/[rootId]/+page.server';
import { load as lessonLoad } from '../lessons/[id]/+page.server';

let db: Db;
let lesson: number;

const user = (id: string) => ({ id, isAdmin: false, timezone: 'UTC' });
const ev = (uid: string, kind = 'lesson', rootId = lesson, request?: Request) =>
	({
		params: { dance: 'salsa', id: '1', kind, rootId: String(rootId) },
		locals: { user: user(uid) },
		request
	}) as never;
const post = (fields: Record<string, string>) =>
	new Request('http://localhost/x', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(fields)
	});
async function run(fn: () => unknown) {
	try {
		return { value: await fn() };
	} catch (e) {
		return { status: (e as { status?: number }).status };
	}
}
type Loaded = { changes: { id: number; line: string; restorable: boolean }[] };

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const [id, firstName] of [
		['u1', 'Ana'],
		['u2', 'Luka'],
		['u3', 'Maja']
	])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName })
			.run();
	const made = createTeam(db, 'u1', 'salsa', 'Class', 1);
	if (!made.ok || made.teamId !== 1) throw new Error('setup');
	joinTeam(db, 'u2', 1, 2);
	setRole(db, 1, 'u2', 'editor');
	joinTeam(db, 'u3', 1, 3);
	lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: 'old' }).lesson
		.id;
	updateLesson(
		db,
		lesson,
		{ lessonDay: '2026-11-01', title: 'C', notes: 'new' },
		'u2',
		Date.now() + 1_000
	);
});

describe('History', () => {
	it('shows an editor the lines, newest first, with Restore on text', async () => {
		const { value } = await run(() => load(ev('u2')));
		const data = value as Loaded;
		expect(data.changes.map((c) => c.line)).toEqual([
			'Luka · changed the notes',
			'Ana · made the lesson'
		]);
		expect(data.changes.map((c) => c.restorable)).toEqual([true, false]);
	});

	it('is a 404 for a member, an outsider, another group’s thing and a person’s own', async () => {
		expect(await run(() => load(ev('u3')))).toEqual({ status: 404 });
		expect(await run(() => load(ev('u9')))).toEqual({ status: 404 });
		const own = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'Mine', notes: null })
			.lesson.id;
		expect(await run(() => load(ev('u1', 'lesson', own)))).toEqual({ status: 404 });
		expect(await run(() => load(ev('u1', 'team', 1)))).toEqual({ status: 404 });
		const drill = createCustomExercise(db, T1_SALSA, { name: 'D', everyDays: 3, notes: null }).id;
		expect((await run(() => load(ev('u1', 'drill', drill)))).value).toBeTruthy();
		// The drill's id under another kind is not the drill.
		expect(await run(() => load(ev('u1', 'routine', drill)))).toEqual({ status: 404 });
	});

	it('restores, and refuses with who when the text changed since', async () => {
		const change = history(db, 1, 'lesson', lesson).find((r) => r.verb === 'change')!;
		updateLesson(
			db,
			lesson,
			{ lessonDay: '2026-11-01', title: 'C', notes: 'newer' },
			'u1',
			Date.now() + 2_000
		);
		const refused = await run(() =>
			actions.restore!(ev('u2', 'lesson', lesson, post({ changeId: String(change.id) })))
		);
		expect(refused.value).toMatchObject({ status: 409 });
		expect(getLessonRow(db, lesson)!.notes).toBe('newer');

		const latest = history(db, 1, 'lesson', lesson)[0];
		const done = await run(() =>
			actions.restore!(ev('u2', 'lesson', lesson, post({ changeId: String(latest.id) })))
		);
		expect(done.value).toMatchObject({ ok: true });
		expect(getLessonRow(db, lesson)!.notes).toBe('new');
	});

	it('refuses a member’s Restore as the stranger’s 404', async () => {
		const change = history(db, 1, 'lesson', lesson).find((r) => r.verb === 'change')!;
		const res = await run(() =>
			actions.restore!(ev('u3', 'lesson', lesson, post({ changeId: String(change.id) })))
		);
		expect(res).toEqual({ status: 404 });
		expect(getLessonRow(db, lesson)!.notes).toBe('new');
	});
});

describe('Edited by', () => {
	const page = (uid: string) =>
		lessonLoad({
			params: { dance: 'salsa', id: String(lesson) },
			locals: { user: user(uid) }
		} as never) as unknown as { edited: string | null; historyHref: string | null };

	it('names the last change to the lesson, and links History for its editors only', () => {
		updateLesson(db, lesson, { lessonDay: '2026-11-01', title: 'C', notes: 'x' }, 'u2', Date.now());
		expect(page('u1').edited).toBe('Edited by Luka · just now');
		expect(page('u1').historyHref).toBe(`/salsa/groups/1/history/lesson/${lesson}`);
	});

	it('is nothing on a person’s own lesson', () => {
		lesson = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'Mine', notes: null })
			.lesson.id;
		expect(page('u1')).toMatchObject({ edited: null, historyHref: null });
	});
});
