/**
 * The worker's loop routes, end to end on a temp `$DATA_DIR` and an
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
import { recordings, videoLoops } from '$lib/server/db/schema';
import { loopsDir, recordingsDir } from '$lib/server/files';
import { makeWorld, type World } from '$lib/server/sync/test-world';
import { unlinkSpot } from '$lib/server/spot-links';
import { updateSpot } from '$lib/server/spots';
import { POST as claim } from './claim/+server';
import { GET as source } from './[id]/source/+server';
import { PUT as putClip } from './[id]/clip/+server';
import { PUT as putStill } from './[id]/still/+server';
import { POST as done } from './[id]/done/+server';
import { POST as fail } from './[id]/fail/+server';

let db: Db;
let w: World;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-loops-'));
	db = openDb(':memory:');
	handle.db = db;
	w = makeWorld(db);
	// Only u1's recording section is linked to a figure.
	unlinkSpot(db, w.own.u4.spotLink, { figureId: w.own.u4.figure });
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

const ev = (params: Record<string, string>, request: Request) => ({ params, request }) as never;
const post = (body: unknown) =>
	new Request('http://localhost/', { method: 'POST', body: JSON.stringify(body) });
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
/** An MP4's start: a box size, then `ftyp`. */
const MP4 = new Uint8Array([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const put = (bytes: Uint8Array) =>
	new Request('http://localhost/', {
		method: 'PUT',
		body: new Blob([bytes as Uint8Array<ArrayBuffer>])
	});
const claimed = async () =>
	(await claim(ev({}, post({})))).json() as Promise<{
		id: number;
		start_ms: number;
		end_ms: number;
	}>;
const row = () => db.select().from(videoLoops).all()[0];

describe('the worker loop routes', () => {
	it('claim queues and gives the section, then 204', async () => {
		expect(await claimed()).toEqual({ id: row().id, start_ms: 0, end_ms: 1000 });
		expect((await claim(ev({}, post({})))).status).toBe(204);
	});

	it('source answers a Range with 206', async () => {
		const { id } = await claimed();
		const file = db.select().from(recordings).where(eq(recordings.id, w.own.u1.recording)).get()!
			.file;
		await writeFile(join(recordingsDir(), file), 'video bytes');
		const r = await source(
			ev({ id: String(id) }, new Request('http://localhost/', { headers: { range: 'bytes=0-4' } }))
		);
		expect(r.status).toBe(206);
		expect(await r.text()).toBe('video');
	});

	it('clip, still, done: ready, files under their names', async () => {
		const { id } = await claimed();
		expect((await putClip(ev({ id: String(id) }, put(MP4)))).status).toBe(204);
		expect((await done(ev({ id: String(id) }, post({})))).status).toBe(409);
		expect((await putStill(ev({ id: String(id) }, put(JPEG)))).status).toBe(204);
		expect((await done(ev({ id: String(id) }, post({})))).status).toBe(201);
		expect(row().status).toBe('ready');
		const spot = w.own.u1.spot;
		expect(existsSync(join(loopsDir(), `${spot}-0-1000.mp4`))).toBe(true);
		expect(existsSync(join(loopsDir(), `${spot}-0-1000-frame.jpg`))).toBe(true);
	});

	it('a clip that is not an MP4 is 400 (a JPEG neither, nor a still that is not one), one too large 413', async () => {
		const { id } = await claimed();
		const status = async (r: Response | Promise<Response>) => (await r).status;
		expect(await status(putClip(ev({ id: String(id) }, put(new Uint8Array([1, 2, 3])))))).toBe(400);
		expect(await status(putClip(ev({ id: String(id) }, put(JPEG))))).toBe(400);
		expect(await status(putStill(ev({ id: String(id) }, put(MP4))))).toBe(400);
		const big = new Uint8Array(1024 * 1024 + 1);
		big.set(MP4);
		expect(await status(putClip(ev({ id: String(id) }, put(big))))).toBe(413);
	});

	it('a span edited after the claim is 410', async () => {
		const { id } = await claimed();
		updateSpot(db, w.own.u1.spot, { startMs: 100, endMs: 1000 }, 'u1');
		expect((await putClip(ev({ id: String(id) }, put(MP4)))).status).toBe(410);
		expect((await source(ev({ id: String(id) }, new Request('http://localhost/')))).status).toBe(
			410
		);
	});

	it('fail for good marks it failed', async () => {
		const { id } = await claimed();
		const r = await fail(ev({ id: String(id) }, post({ error: 'no picture', permanent: true })));
		expect(r.status).toBe(204);
		expect(row()).toMatchObject({ status: 'failed', error: 'no picture' });
	});
});
