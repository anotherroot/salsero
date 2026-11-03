/**
 * Make my own copy through the lesson page: the menu's cost line, the copy
 * opening as the person's own lesson, the refusals. Files live in a temp
 * folder, never `$DATA_DIR`; the disk is said to be roomy.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown, dir: '' }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});
vi.mock('$lib/server/files', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/files')>('$lib/server/files');
	return { ...actual, lessonVideosDir: () => handle.dir };
});
vi.mock('$lib/server/storage', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/storage')>('$lib/server/storage');
	return { ...actual, freeDisk: async () => 1024 ** 4 };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { lessons, users } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { addLessonVideo, archiveLesson, createLesson, publishLesson } from '$lib/server/lessons';
import { T1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { actions, load } from './[id]/+page.server';

const VIDEO = '0b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';
let db: Db;
let lesson: number;

const ev = (uid: string, id: number) =>
	({
		params: { dance: 'salsa', id: String(id) },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC' } },
		url: new URL(`http://localhost/salsa/lessons/${id}`),
		request: new Request('http://localhost/x', { method: 'POST', body: new URLSearchParams() })
	}) as never;
async function run(fn: () => unknown) {
	try {
		return { value: await fn() };
	} catch (e) {
		return {
			status: (e as { status?: number }).status,
			location: (e as { location?: string }).location
		};
	}
}

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	handle.dir = mkdtempSync(join(tmpdir(), 'salsa-copy-route-'));
	for (const id of ['u1', 'u2', 'u3'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName: id })
			.run();
	createTeam(db, 'u1', 'salsa', 'Salsa nadaljevalna', 1);
	joinTeam(db, 'u2', 1, 2);
	lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-03', title: 'Tue 3 Nov', notes: null })
		.lesson.id;
	writeFileSync(join(handle.dir, VIDEO), 'bytes');
	addLessonVideo(db, { lessonId: lesson, file: VIDEO, mime: 'video/mp4', sizeBytes: 5 }, 'u1');
	publishLesson(db, T1_SALSA, lesson, 2);
});

afterEach(() => rmSync(handle.dir, { recursive: true, force: true }));

describe('the lesson page’s Make my own copy', () => {
	it('shows a member what the copy costs and brings; a person’s own lesson has none', async () => {
		const page = (await load(ev('u2', lesson))) as { copy: unknown };
		expect(page.copy).toEqual({ bytes: 5, videos: 1, variations: 0, routines: 0, drills: 0 });
		const own = createLesson(db, U2_SALSA, { lessonDay: '2026-11-03', title: 'O', notes: null })
			.lesson.id;
		expect(((await load(ev('u2', own))) as { copy: unknown }).copy).toBeNull();
	});

	it('copies for a member and opens the copy', async () => {
		const res = await run(() => actions.copy!(ev('u2', lesson)));
		expect(res.status).toBe(303);
		const copy = db.select().from(lessons).where(eq(lessons.userId, 'u2')).get()!;
		expect(res.location).toBe(`/salsa/lessons/${copy.id}`);
	});

	it('copying again after archiving the copy brings it back and opens it', async () => {
		await run(() => actions.copy!(ev('u2', lesson)));
		const copy = db.select().from(lessons).where(eq(lessons.userId, 'u2')).get()!;
		expect(archiveLesson(db, copy.id, 5)).toBe(true);
		const res = await run(() => actions.copy!(ev('u2', lesson)));
		expect(res).toMatchObject({ status: 303, location: `/salsa/lessons/${copy.id}` });
		expect(db.select().from(lessons).where(eq(lessons.id, copy.id)).get()!.archivedAt).toBeNull();
		// The page it opens loads.
		expect(await load(ev('u2', copy.id))).toBeTruthy();
	});

	it('is the missing lesson’s 404 for an outsider and on a person’s own lesson', async () => {
		expect((await run(() => actions.copy!(ev('u3', lesson)))).status).toBe(404);
		const own = createLesson(db, U2_SALSA, { lessonDay: '2026-11-03', title: 'O', notes: null })
			.lesson.id;
		expect((await run(() => actions.copy!(ev('u2', own)))).status).toBe(404);
		expect(db.select().from(lessons).all()).toHaveLength(2);
	});

	it('over the limit, refuses with the use and the limit, and Ask for more', async () => {
		db.update(users).set({ storageLimitBytes: 4 }).where(eq(users.id, 'u2')).run();
		const res = await run(() => actions.copy!(ev('u2', lesson)));
		expect(res.value).toMatchObject({
			status: 413,
			data: { action: 'copy', askForMore: true, message: expect.stringContaining('you use') }
		});
		expect(db.select().from(lessons).where(eq(lessons.userId, 'u2')).all()).toEqual([]);
	});
});
