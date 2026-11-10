import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown, dir: '' }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});
// Screenshots in a temporary folder, never $DATA_DIR.
vi.mock('$lib/server/files', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/files')>('$lib/server/files');
	return { ...actual, feedbackDir: () => handle.dir };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { keepShot, sendFeedback } from '$lib/server/feedback';
import { GET } from './+server';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9]);
let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	handle.dir = mkdtempSync(join(tmpdir(), 'shot-route-'));
	db.insert(users).values({ id: 'p', email: 'p@x', passwordHash: 'x', dance: 'salsa' }).run();
});
afterEach(() => rmSync(handle.dir, { recursive: true, force: true }));

function send(dance: 'salsa' | 'bachata'): number {
	const id = sendFeedback(
		db,
		{ userId: 'p', dance },
		{ message: 'x', page: null, trail: [], errors: [], siteVersion: null, viewport: null },
		{ agent: null, userAgent: null },
		1
	);
	keepShot(db, handle.dir, id, JPEG);
	return id;
}

const get = (id: number | string, isAdmin = true, dance = 'salsa') =>
	(GET as unknown as (e: unknown) => Promise<Response>)({
		params: { id: String(id) },
		locals: { user: { id: 'admin', isAdmin, dance } },
		request: new Request('http://localhost/')
	});

describe('a feedback screenshot', () => {
	it('is served to the admin of its dance', async () => {
		const res = await get(send('salsa'));
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('image/jpeg');
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
	});

	it('is a 404 to anyone else, and for another dance’s or a missing one', async () => {
		const id = send('salsa');
		await expect(get(id, false)).rejects.toMatchObject({ status: 404 });
		await expect(get(id, true, 'bachata')).rejects.toMatchObject({ status: 404 });
		await expect(get(999)).rejects.toMatchObject({ status: 404 });
		await expect(get('x')).rejects.toMatchObject({ status: 404 });
	});
});
