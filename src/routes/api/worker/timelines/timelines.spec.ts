/**
 * The worker's timeline routes, end to end on a temp `$DATA_DIR` and an
 * in-memory db. Both are mocked, never set through `process.env` — see CLAUDE.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';

const envMock = vi.hoisted(() => ({ DATA_DIR: '' }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));
const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { lessonVideos, videoSpots } from '$lib/server/db/schema';
import { lessonVideosDir } from '$lib/server/files';
import { makeWorld, type World } from '$lib/server/sync/test-world';
import { askTimeline, timelineDir, timelineOf } from '$lib/server/ai-timelines/store';
import { POST as claim } from './claim/+server';
import { GET as source } from './[id]/source/+server';
import { PUT as putPiece } from './[id]/pieces/[k]/+server';
import { POST as done } from './[id]/done/+server';
import { POST as fail } from './[id]/fail/+server';

let db: Db;
let w: World;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-timelines-'));
	db = openDb(':memory:');
	handle.db = db;
	w = makeWorld(db);
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

// The handlers read only params and request.

const ev = (params: Record<string, string>, request: Request) => ({ params, request }) as never;
const post = (body: unknown) =>
	new Request('http://localhost/', { method: 'POST', body: JSON.stringify(body) });
const piece = (id: number, k: number, body: unknown) =>
	putPiece(
		ev(
			{ id: String(id), k: String(k) },
			new Request('http://localhost/', { method: 'PUT', body: JSON.stringify(body) })
		)
	);

const video = () => ({ lessonVideoId: w.own.u1.video });

describe('the worker timeline routes', () => {
	it('claim gives the queued timeline, then 204', async () => {
		const t = askTimeline(db, video(), Date.now());
		const first = await claim(ev({}, post({})));
		expect(await first.json()).toEqual({ id: t.id });
		expect((await claim(ev({}, post({})))).status).toBe(204);
	});

	it('a piece then done makes it ready', async () => {
		const t = askTimeline(db, video(), Date.now());
		const r = await piece(t.id, 0, { frames: [{ t_ms: 0, data: 'AAAA' }], sound: null });
		expect(r.status).toBe(204);
		expect(existsSync(join(timelineDir(t.id), '0.json'))).toBe(true);
		const d = await done(ev({ id: String(t.id) }, post({ pieces: 1, duration_ms: 40_000 })));
		expect(d.status).toBe(201);
		expect(timelineOf(db, video())).toMatchObject({
			status: 'ready',
			pieces: 1,
			durationMs: 40_000
		});
	});

	it('done with a missing piece is 400', async () => {
		const t = askTimeline(db, video(), Date.now());
		await piece(t.id, 0, { frames: [], sound: null });
		const d = await done(ev({ id: String(t.id) }, post({ pieces: 2, duration_ms: 90_000 })));
		expect(d.status).toBe(400);
		expect(timelineOf(db, video())?.status).toBe('queued');
	});

	it('done whose pieces do not match the duration is 400', async () => {
		const t = askTimeline(db, video(), Date.now());
		await piece(t.id, 0, { frames: [], sound: null });
		const d = await done(ev({ id: String(t.id) }, post({ pieces: 1, duration_ms: 90_000 })));
		expect(d.status).toBe(400);
	});

	it('a bad piece is 400 with the reason', async () => {
		const t = askTimeline(db, video(), Date.now());
		const r = await piece(t.id, 1, { frames: [{ t_ms: 0, data: 'AAAA' }], sound: null });
		expect(r.status).toBe(400);
		expect((await r.json()).message).toMatch(/t_ms/);
	});

	it('410 when the video is gone, and its pieces go', async () => {
		const t = askTimeline(db, video(), Date.now());
		await piece(t.id, 0, { frames: [], sound: null });
		db.delete(videoSpots).where(eq(videoSpots.lessonVideoId, w.own.u1.video)).run();
		db.delete(lessonVideos).where(eq(lessonVideos.id, w.own.u1.video)).run();
		const r = await piece(t.id, 1, { frames: [], sound: null });
		expect(r.status).toBe(410);
		expect(existsSync(timelineDir(t.id))).toBe(false);
		const s = await source(ev({ id: String(t.id) }, new Request('http://localhost/')));
		expect(s.status).toBe(410);
	});

	it('source streams the video file', async () => {
		const t = askTimeline(db, video(), Date.now());
		const file = db
			.select({ file: lessonVideos.file })
			.from(lessonVideos)
			.where(eq(lessonVideos.id, w.own.u1.video))
			.get()!.file;
		await writeFile(join(lessonVideosDir(), file), 'video bytes');
		const s = await source(ev({ id: String(t.id) }, new Request('http://localhost/')));
		expect(s.status).toBe(200);
		expect(await s.text()).toBe('video bytes');
	});

	it('fail for good marks it failed', async () => {
		const t = askTimeline(db, video(), Date.now());
		const r = await fail(ev({ id: String(t.id) }, post({ error: 'no picture', permanent: true })));
		expect(r.status).toBe(204);
		expect(timelineOf(db, video())).toMatchObject({ status: 'failed', error: 'no picture' });
	});
});
