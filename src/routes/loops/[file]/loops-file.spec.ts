/**
 * A loop file: only to who may read its video, only for the spot's current span.
 * `$DATA_DIR` and the db are mocked, never set through `process.env` — see CLAUDE.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const envMock = vi.hoisted(() => ({ DATA_DIR: '' }));
vi.mock('$env/dynamic/private', () => ({ env: envMock }));
const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { loopsDir } from '$lib/server/files';
import { makeWorld, type World } from '$lib/server/sync/test-world';
import { updateSpot } from '$lib/server/spots';
import { loopName } from '$lib/video/loops';
import { GET } from './+server';

let db: Db;
let w: World;
beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-loop-file-'));
	db = openDb(':memory:');
	handle.db = db;
	w = makeWorld(db);
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

/** A loop file on disk for this spot's span, as the worker leaves it. */
async function cut(spot: number, startMs: number, endMs: number, still = false): Promise<string> {
	const name = loopName({ id: spot, startMs, endMs }, still);
	await writeFile(join(loopsDir(), name), 'jpeg');
	return name;
}
const get = async (userId: string, file: string) => {
	try {
		return await GET({
			params: { file },
			request: new Request('http://localhost/'),
			locals: { user: { id: userId } }
		} as never);
	} catch (e) {
		return new Response(null, { status: (e as { status: number }).status });
	}
};

describe('/loops/[file]', () => {
	it("the owner gets their section's loop and still, cached for good", async () => {
		const strip = await cut(w.own.u1.spot, 0, 1000);
		const still = await cut(w.own.u1.spot, 0, 1000, true);
		const r = await get('u1', strip);
		expect(r.status).toBe(200);
		expect(r.headers.get('content-type')).toBe('image/jpeg');
		expect(r.headers.get('cache-control')).toContain('immutable');
		expect((await get('u1', still)).status).toBe(200);
	});

	it("another person's loop and a missing one are the same 404", async () => {
		const strip = await cut(w.own.u1.spot, 0, 1000);
		expect((await get('u4', strip)).status).toBe(404);
		expect((await get('u1', loopName({ id: 999, startMs: 0, endMs: 1000 }))).status).toBe(404);
	});

	it('a member reads a published section, never a draft lesson video', async () => {
		const published = await cut(w.group.spot, 0, 1000);
		const draft = await cut(w.group.draftSpot, 0, 1000);
		expect((await get('u3', published)).status).toBe(200);
		expect((await get('u3', draft)).status).toBe(404);
	});

	it('a stale span, a name that is not a loop, or a loop not cut yet: 404', async () => {
		const strip = await cut(w.own.u1.spot, 0, 1000);
		updateSpot(db, w.own.u1.spot, { startMs: 100, endMs: 1000 }, 'u1');
		expect((await get('u1', strip)).status).toBe(404);
		expect(
			(await get('u1', loopName({ id: w.own.u1.spot, startMs: 100, endMs: 1000 }))).status
		).toBe(404);
		expect((await get('u1', '../x.jpg')).status).toBe(404);
		expect((await get('u1', `${w.own.u1.spot}-100-1000.png`)).status).toBe(404);
	});
});
