/**
 * The spots API, called as SvelteKit would call it. `getDb()` is mocked so no
 * test ever opens the real database — see `src/routes/[dance]/dance-wall.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { addRecording, createFigure } from '$lib/server/figures';
import { addSpot, listSpots } from '$lib/server/spots';
import * as list from './+server';
import * as one from './[id]/+server';

let db: Db;
let recordingId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	const { figure } = createFigure(db, 'salsa', {
		name: 'Enchufla',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!;
	recordingId = addRecording(db, {
		figureId: figure.id,
		file: 'r.mp4',
		mime: 'video/mp4',
		kind: 'video',
		sizeBytes: 10,
		note: null
	}).id;
});

type Handler = (event: unknown) => Promise<Response> | Response;
const run = (h: unknown, event: unknown) => (h as Handler)(event);

const get = (query: string) =>
	run(list.GET, { url: new URL(`http://localhost/api/video-spots?${query}`) });
const send = (method: string, body: unknown, id = '') =>
	new Request(`http://localhost/api/video-spots/${id}`, {
		method,
		headers: { 'content-type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});

/** Run a handler and return the HTTP status it answered or threw. */
async function status(p: () => Promise<Response> | Response): Promise<number> {
	try {
		return (await p()).status;
	} catch (thrown) {
		return (thrown as { status: number }).status;
	}
}

describe('GET /api/video-spots', () => {
	it("lists a recording's spots by start time", async () => {
		addSpot(db, { recordingId }, { startMs: 5000, endMs: null, label: null });
		addSpot(db, { recordingId }, { startMs: 1000, endMs: 2000, label: 'Turn' });
		const res = await get(`recording=${recordingId}`);
		expect(res.status).toBe(200);
		expect((await res.json()).map((s: { startMs: number }) => s.startMs)).toEqual([1000, 5000]);
	});

	it.each(['', 'recording=abc', 'recording=0', `recording=1&lessonVideo=1`])(
		'is a 400 for "%s"',
		async (query) => {
			expect(await status(() => get(query))).toBe(400);
		}
	);

	it('is a 404 for a video that does not exist', async () => {
		expect(await status(() => get('lessonVideo=999'))).toBe(404);
	});
});

describe('POST /api/video-spots', () => {
	it('creates a spot and answers 201 with it', async () => {
		const res = await run(list.POST, {
			request: send('POST', { recordingId, startMs: 1000, endMs: 3000, label: 'Turn' })
		});
		expect(res.status).toBe(201);
		expect(await res.json()).toMatchObject({ startMs: 1000, endMs: 3000, label: 'Turn' });
		expect(listSpots(db, { recordingId })).toHaveLength(1);
	});

	it.each([
		['bad JSON', '{'],
		['a non-object', '[1]'],
		['no owner', { startMs: 0 }],
		['an end before the start', { recordingId: 0, startMs: 10, endMs: 5 }]
	])('is a 400 for %s', async (_, body) => {
		const b = typeof body === 'object' && 'recordingId' in body ? { ...body, recordingId } : body;
		expect(await status(() => run(list.POST, { request: send('POST', b) }))).toBe(400);
		expect(listSpots(db, { recordingId })).toEqual([]);
	});

	it('is a 404 for a video that does not exist', async () => {
		const req = send('POST', { recordingId: 999, startMs: 0, endMs: null, label: null });
		expect(await status(() => run(list.POST, { request: req }))).toBe(404);
	});
});

describe('PATCH and DELETE /api/video-spots/[id]', () => {
	it('renames, then deletes', async () => {
		const spot = addSpot(db, { recordingId }, { startMs: 0, endMs: null, label: null })!;
		const id = String(spot.id);

		const renamed = await run(one.PATCH, {
			params: { id },
			request: send('PATCH', { label: 'Dip' }, id)
		});
		expect(await renamed.json()).toMatchObject({ id: spot.id, label: 'Dip' });

		const gone = await run(one.DELETE, { params: { id } });
		expect(gone.status).toBe(204);
		expect(listSpots(db, { recordingId })).toEqual([]);
	});

	it.each(['0', 'abc', '999'])('is a 404 for spot "%s"', async (id) => {
		expect(await status(() => run(one.DELETE, { params: { id } }))).toBe(404);
		expect(
			await status(() =>
				run(one.PATCH, { params: { id }, request: send('PATCH', { label: 'x' }, id) })
			)
		).toBe(404);
	});

	it('is a 400 for a bad label', async () => {
		const spot = addSpot(db, { recordingId }, { startMs: 0, endMs: null, label: null })!;
		const id = String(spot.id);
		const req = send('PATCH', { label: 'x'.repeat(81) }, id);
		expect(await status(() => run(one.PATCH, { params: { id }, request: req }))).toBe(400);
	});

	it('is a 400 for a body with no label key, and leaves the label alone', async () => {
		const spot = addSpot(db, { recordingId }, { startMs: 0, endMs: null, label: 'Dip' })!;
		const id = String(spot.id);
		const req = send('PATCH', {}, id);
		expect(await status(() => run(one.PATCH, { params: { id }, request: req }))).toBe(400);
		expect(listSpots(db, { recordingId })[0]).toMatchObject({ label: 'Dip' });
	});
});
