/**
 * A group's What uses space: editors and owner only, Delete trashes and leaves
 * the file for the purge (risk 19), Ask for more is the owner's.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
	return { ...actual, lessonVideosDir: () => handle.dir, recordingsDir: () => handle.dir };
});

import { openDb, type Db } from '$lib/server/db';
import { lessonVideos, storageRequests, teamTrash, users } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { addLessonVideo, createLesson } from '$lib/server/lessons';
import { askForMore, openRequest } from '$lib/server/storage';
import { T1_SALSA } from '$lib/server/test-walls';
import { actions, load } from './[id]/storage/+page.server';
import { load as groupLoad } from './[id]/+page.server';

let db: Db;
const FILE = '0b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';

const ev = (uid: string, id = '1', fields?: Record<string, string>) =>
	({
		params: { dance: 'salsa', id },
		locals: { user: { id: uid, isAdmin: false, timezone: 'UTC' } },
		url: new URL('http://localhost/x'),
		request: new Request('http://localhost/x', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields ?? {})
		})
	}) as never;
async function run(fn: () => unknown) {
	try {
		return { value: await fn() };
	} catch (e) {
		return { status: (e as { status?: number }).status };
	}
}

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	handle.dir = mkdtempSync(join(tmpdir(), 'salsa-gstorage-'));
	for (const id of ['u1', 'u2', 'u3', 'u4'])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x' })
			.run();
	createTeam(db, 'u1', 'salsa', 'Class', 1);
	joinTeam(db, 'u2', 1, 2);
	setRole(db, 1, 'u2', 'editor');
	joinTeam(db, 'u3', 1, 3);
});
afterEach(() => rmSync(handle.dir, { recursive: true, force: true }));

function video() {
	const lesson = createLesson(db, T1_SALSA, {
		lessonDay: '2026-11-01',
		title: 'Turns',
		notes: null
	}).lesson.id;
	writeFileSync(join(handle.dir, FILE), 'video');
	return addLessonVideo(db, { lessonId: lesson, file: FILE, mime: 'video/mp4', sizeBytes: 5 }, 'u1')
		.id;
}

describe("a group's What uses space", () => {
	it('is a 404 for a member and an outsider; editors and owner see the items', async () => {
		video();
		for (const uid of ['u3', 'u4']) {
			expect((await run(() => load(ev(uid)))).status).toBe(404);
			expect((await run(() => actions.deleteVideo!(ev(uid)))).status).toBe(404);
			expect((await run(() => actions.ask!(ev(uid)))).status).toBe(404);
		}
		for (const uid of ['u1', 'u2']) {
			const d = (await load(ev(uid))) as { items: { context: string }[] };
			expect(d.items.map((i) => i.context)).toEqual(['Lesson · Turns']);
		}
	});

	it('Delete trashes the video and leaves the file for the purge', async () => {
		const id = video();
		const done = await run(() => actions.deleteVideo!(ev('u2', '1', { id: String(id) })));
		expect(done.value).toMatchObject({ ok: true });
		expect(db.select().from(lessonVideos).all()).toEqual([]);
		expect(db.select().from(teamTrash).all()).toHaveLength(1);
		expect(existsSync(join(handle.dir, FILE))).toBe(true);
		// The trashed file still counts, and is marked.
		const d = (await load(ev('u1'))) as {
			items: { context: string }[];
			storage: { usedBytes: number };
		};
		expect(d.items[0].context).toMatch(/in Recently deleted$/);
		expect(d.storage.usedBytes).toBe(5);
	});

	it('refuses an id that is not this group’s', async () => {
		const done = await run(() => actions.deleteVideo!(ev('u1', '1', { id: '999' })));
		expect(done.value).toMatchObject({ status: 404 });
	});

	it('Ask for more is the owner’s; an editor gets the 404', async () => {
		expect((await run(() => actions.ask!(ev('u2', '1', { note: 'hi' })))).status).toBe(404);
		expect(db.select().from(storageRequests).all()).toEqual([]);
		const done = await run(() => actions.ask!(ev('u1', '1', { note: 'hi' })));
		expect(done.value).toEqual({ asked: true });
		expect(openRequest(db, 'u1', 1)).not.toBeNull();
		expect(openRequest(db, 'u1')).toBeNull();
		const d = (await load(ev('u1'))) as { asked: string | null };
		expect(d.asked).toMatch(/waiting$/);
		const e = (await load(ev('u2'))) as { asked: string | null };
		expect(e.asked).toBeNull();
		askForMore(db, { userId: 'u1' }, null, 5);
		expect(db.select().from(storageRequests).all()).toHaveLength(2);
	});

	it('the group page carries the storage line for editors, not members', async () => {
		const own = (await groupLoad(ev('u2'))) as { storage: unknown };
		expect(own.storage).toEqual({ usedBytes: 0, limitBytes: 600 * 1024 ** 2 });
		const member = (await groupLoad(ev('u3'))) as { storage: unknown };
		expect(member.storage).toBeNull();
	});
});
