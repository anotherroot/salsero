import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { createFigure } from '$lib/server/figures';
import { addLinks, listLinks } from '$lib/server/links';
import { requestVideoDownload } from '$lib/server/video-downloads';
import { POST as claim } from './+server';
import { POST as fail } from '../[id]/fail/+server';

const YT = 'https://youtu.be/dQw4w9WgXcQ';
let db: Db;
let figureId: number;
beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	figureId = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
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
