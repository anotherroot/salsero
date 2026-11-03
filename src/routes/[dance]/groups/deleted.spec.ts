/**
 * Recently deleted: its editors' and owner's only, Restore per row with its
 * refusal on the row, and the routes that delete a group's file leave it on
 * disk for the purge (risk 19). Files go to a temp folder, never `$DATA_DIR`.
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
import { lessonVideos, users } from '$lib/server/db/schema';
import { createTeam, joinTeam, setRole } from '$lib/server/teams';
import { addLessonVideo, archiveLesson, createLesson, getLessonRow } from '$lib/server/lessons';
import { addSpot, deleteSpot } from '$lib/server/spots';
import { addRecording, createFigure } from '$lib/server/figures';
import { T1_SALSA, U1_SALSA } from '$lib/server/test-walls';
import type { Space } from '$lib/server/scope';
import { actions, load } from './[id]/deleted/+page.server';
import { actions as lessonActions } from '../lessons/[id]/+page.server';
import { actions as figureActions } from '../figures/[id]/+page.server';

let db: Db;
const FILE = '0b9e8c3a-1d2f-4a5b-8c7d-6e5f4a3b2c1d.mp4';

const user = (id: string) => ({ id, isAdmin: false, timezone: 'UTC' });
const ev = (uid: string, params: Record<string, string>, request?: Request) =>
	({ params: { dance: 'salsa', ...params }, locals: { user: user(uid) }, request }) as never;
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

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	handle.dir = mkdtempSync(join(tmpdir(), 'salsa-deleted-'));
	for (const [id, firstName] of [
		['u1', 'Ana'],
		['u2', 'Luka'],
		['u3', 'Maja']
	])
		db.insert(users)
			.values({ id, email: `${id}@x.si`, passwordHash: 'x', firstName })
			.run();
	createTeam(db, 'u1', 'salsa', 'Class', 1);
	joinTeam(db, 'u2', 1, 2);
	setRole(db, 1, 'u2', 'editor');
	joinTeam(db, 'u3', 1, 3);
});

afterEach(() => rmSync(handle.dir, { recursive: true, force: true }));

function lessonWithVideo(space: Space = T1_SALSA) {
	const lesson = createLesson(db, space, { lessonDay: '2026-11-01', title: 'C', notes: null })
		.lesson.id;
	writeFileSync(join(handle.dir, FILE), 'video');
	const video = addLessonVideo(
		db,
		{ lessonId: lesson, file: FILE, mime: 'video/mp4', sizeBytes: 5 },
		'u1'
	).id;
	return { lesson, video };
}

describe('the lesson page’s deleteVideo (risk 19)', () => {
	it('leaves a group video’s file on disk, in Recently deleted', async () => {
		const { lesson, video } = lessonWithVideo();
		const done = await run(() =>
			lessonActions.deleteVideo!(ev('u2', { id: String(lesson) }, post({ videoId: String(video) })))
		);
		expect(done.value).toMatchObject({ ok: true });
		expect(db.select().from(lessonVideos).all()).toEqual([]);
		expect(existsSync(join(handle.dir, FILE))).toBe(true);
	});

	it('still removes a person’s own file at once', async () => {
		const { lesson, video } = lessonWithVideo(U1_SALSA);
		await run(() =>
			lessonActions.deleteVideo!(ev('u1', { id: String(lesson) }, post({ videoId: String(video) })))
		);
		expect(existsSync(join(handle.dir, FILE))).toBe(false);
	});
});

describe('the figure page’s deleteRecording (risk 19)', () => {
	it('leaves a group recording’s file on disk', async () => {
		const figure = createFigure(db, T1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!.figure.id;
		writeFileSync(join(handle.dir, FILE), 'rec');
		const rec = addRecording(
			db,
			{ figureId: figure, file: FILE, mime: 'video/mp4', kind: 'video', sizeBytes: 5, note: null },
			'u1'
		).id;
		const done = await run(() =>
			figureActions.deleteRecording!(
				ev('u1', { id: String(figure) }, post({ recordingId: String(rec) }))
			)
		);
		expect(done.value).toMatchObject({ ok: true });
		expect(existsSync(join(handle.dir, FILE))).toBe(true);
	});
});

describe('Recently deleted', () => {
	it('is a 404 for a member and an outsider; an editor sees the rows', async () => {
		const { lesson, video } = lessonWithVideo();
		const spot = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 0, endMs: 4000, label: 'Enchufla doble' },
			'u1'
		)!.id;
		deleteSpot(db, spot, 'u2');
		archiveLesson(db, lesson, Date.now() + 1000, 'u1');
		expect(await run(() => load(ev('u3', { id: '1' })))).toEqual({ status: 404 });
		expect(await run(() => load(ev('u9', { id: '1' })))).toEqual({ status: 404 });
		const { value } = await run(() => load(ev('u2', { id: '1' })));
		const items = (value as { items: { kind: string; by: string; purgeOn: string | null }[] })
			.items;
		expect(items.map((i) => [i.kind, i.by])).toEqual([
			['lesson', 'Ana'],
			['section', 'Luka']
		]);
		expect(items[1].purgeOn).not.toBeNull();
	});

	it('restores a row; a refusal names why, on its row', async () => {
		const { lesson, video } = lessonWithVideo();
		const spot = addSpot(
			db,
			{ lessonVideoId: video },
			{ startMs: 0, endMs: 4000, label: 'Enchufla doble' },
			'u1'
		)!.id;
		const { trashId } = deleteSpot(db, spot, 'u1')!;
		await run(() =>
			lessonActions.deleteVideo!(ev('u1', { id: String(lesson) }, post({ videoId: String(video) })))
		);
		const refused = await run(() =>
			actions.restore!(ev('u2', { id: '1' }, post({ kind: 'section', id: String(trashId) })))
		);
		expect(refused.value).toMatchObject({
			status: 409,
			data: { key: `section-${trashId}`, message: 'Restore the video first' }
		});

		archiveLesson(db, lesson, Date.now() + 1000, 'u1');
		const done = await run(() =>
			actions.restore!(ev('u2', { id: '1' }, post({ kind: 'lesson', id: String(lesson) })))
		);
		expect(done.value).toMatchObject({ ok: true });
		expect(getLessonRow(db, lesson)!.archivedAt).toBeNull();
	});

	it('refuses a member’s Restore, and another group’s id, as a 404', async () => {
		const own = createLesson(db, U1_SALSA, { lessonDay: '2026-11-01', title: 'M', notes: null })
			.lesson.id;
		archiveLesson(db, own, Date.now(), 'u1');
		const body = () => post({ kind: 'lesson', id: String(own) });
		expect(await run(() => actions.restore!(ev('u3', { id: '1' }, body())))).toEqual({
			status: 404
		});
		expect((await run(() => actions.restore!(ev('u1', { id: '1' }, body())))).value).toMatchObject({
			status: 404
		});
		expect(getLessonRow(db, own)!.archivedAt).not.toBeNull();
	});
});
