import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
import { videoDownloads } from '$lib/server/db/schema';
import { createFigure } from '$lib/server/figures';
import { addLinks, listLinks } from '$lib/server/links';
import { requestVideoDownload } from '$lib/server/video-downloads';
import { POST as claim } from './+server';
import { POST as fail } from '../[id]/fail/+server';

const YT = 'https://youtu.be/dQw4w9WgXcQ';
let db: Db;
let figureId: number;
beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-claim-'));
	db = openDb(':memory:');
	handle.db = db;
	figureId = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- only the fields the handlers read
const call = (handler: (e: any) => unknown, event: object) => handler(event) as Promise<Response>;

describe('claim and fail', () => {
	it('hands out the queued link, then nothing; a permanent failure shows on the link', async () => {
		const link = addLinks(db, { figureId }, [YT], null)![0];
		requestVideoDownload(db, { figureId }, link.id);

		const got = await call(claim, {});
		expect(got.status).toBe(200);
		const job = await got.json();
		expect(job).toEqual({ id: expect.any(Number), url: YT });
		expect((await call(claim, {})).status).toBe(204);

		const request = new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ error: 'Private video', permanent: true })
		});
		expect((await call(fail, { params: { id: String(job.id) }, request })).status).toBe(204);
		expect(listLinks(db, { figureId })[0].saving).toEqual({
			status: 'failed',
			error: 'Private video'
		});
	});
});

describe('a claim starts a fresh attempt', () => {
	it('drops the partial an earlier attempt left, so a new encode never resumes onto it', async () => {
		const link = addLinks(db, { figureId }, [YT], null)![0];
		requestVideoDownload(db, { figureId }, link.id);
		const first = await (await call(claim, {})).json();

		// The first attempt got 8 bytes up, then failed transiently and its lease ran out.
		const partial = join(envMock.DATA_DIR, 'uploads', `video-${first.id}.part`);
		await mkdir(join(envMock.DATA_DIR, 'uploads'), { recursive: true });
		await writeFile(partial, new Uint8Array(8));
		db.update(videoDownloads).set({ claimedAt: 0 }).run();

		const again = await (await call(claim, {})).json();
		expect(again.id).toBe(first.id);
		expect(existsSync(partial)).toBe(false);
	});
});
