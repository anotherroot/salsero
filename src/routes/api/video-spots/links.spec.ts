/**
 * A section's links through `/api/video-spots/[id]/links`, called as SvelteKit
 * would call it. `getDb()` is mocked so no test opens the real database — see
 * `src/routes/[dance]/dance-wall.spec.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { lessonFigures } from '$lib/server/db/schema';
import { createFigure } from '$lib/server/figures';
import { addLessonVideo, createLesson, linkFigure } from '$lib/server/lessons';
import { addSpot } from '$lib/server/spots';
import { linkSpot } from '$lib/server/spot-links';
import * as links from './[id]/links/+server';
import * as one from './[id]/links/[linkId]/+server';
import type { LinkOptions } from '$lib/types';

const USER = { id: 'u1', email: 'u@example.com', timezone: 'Europe/Ljubljana' };

let db: Db;
let lessonId: number;
let basic: number;
let paseo: number;
let section: number;
let other: number;
let point: number;

const fig = (dance: 'salsa' | 'bachata', figureName: string) =>
	createFigure(db, dance, {
		figureName,
		name: 'Basic',
		partner: 'partner',
		style: dance === 'salsa' ? 'salsa' : 'sensual',
		notes: null
	})!.figure.id;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	basic = fig('salsa', 'Enchufla');
	paseo = fig('bachata', 'Paseo');
	lessonId = createLesson(db, 'salsa', { lessonDay: '2026-10-12', title: 'Cubana', notes: null })
		.lesson.id;
	const lessonVideoId = addLessonVideo(db, {
		lessonId,
		file: 'l.mp4',
		mime: 'video/mp4',
		sizeBytes: 1
	}).id;
	section = addSpot(db, { lessonVideoId }, { startMs: 0, endMs: 3000, label: null })!.id;
	other = addSpot(db, { lessonVideoId }, { startMs: 4000, endMs: 7000, label: null })!.id;
	point = addSpot(db, { lessonVideoId }, { startMs: 500, endMs: null, label: null })!.id;
});

type Handler = (event: unknown) => Promise<Response> | Response;
const run = (h: unknown, event: unknown) => (h as Handler)(event);

const get = (id: string | number) =>
	run(links.GET, { params: { id: String(id) }, locals: { user: USER } });
const post = (id: string | number, body: unknown) =>
	run(links.POST, {
		params: { id: String(id) },
		locals: { user: USER },
		request: new Request(`http://localhost/api/video-spots/${id}/links`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: typeof body === 'string' ? body : JSON.stringify(body)
		})
	});
const del = (id: number, linkId: number, alsoLesson = false) =>
	run(one.DELETE, {
		params: { id: String(id), linkId: String(linkId) },
		locals: { user: USER },
		url: new URL(
			`http://localhost/api/video-spots/${id}/links/${linkId}${alsoLesson ? '?alsoLesson=1' : ''}`
		)
	});

/** The HTTP status and message a handler answered or threw. */
async function outcome(p: () => Promise<Response> | Response) {
	try {
		const res = await p();
		return { status: res.status, body: (await res.json()) as LinkOptions };
	} catch (thrown) {
		const t = thrown as { status: number; body?: { message?: string } };
		return { status: t.status, message: t.body?.message };
	}
}

describe('GET /api/video-spots/[id]/links', () => {
	it("answers the section's link options", async () => {
		const res = await outcome(() => get(section));
		expect(res.status).toBe(200);
		expect(res.body!.linked).toEqual([]);
		expect(res.body!.defaults).toEqual({ partner: 'partner', style: 'salsa' });
	});

	it.each(['abc', '0', String(9999)])('is a 404 for spot %s', async (id) => {
		expect((await outcome(() => get(id))).status).toBe(404);
	});

	it('is a 404 for a point', async () => {
		expect((await outcome(() => get(point))).status).toBe(404);
	});
});

describe('POST /api/video-spots/[id]/links', () => {
	it('links an existing variation', async () => {
		const res = await outcome(() => post(section, { target: { figureId: basic } }));
		expect(res.status).toBe(200);
		expect(res.body!.linked.map((l) => l.label)).toEqual(['Enchufla · Basic']);
	});

	it('is a 409 for the same target twice', async () => {
		await post(section, { target: { figureId: basic } });
		expect((await outcome(() => post(section, { target: { figureId: basic } }))).status).toBe(409);
	});

	it('is a 400 for a target of the other dance', async () => {
		expect((await outcome(() => post(section, { target: { figureId: paseo } }))).status).toBe(400);
	});

	it('creates a figure and links it', async () => {
		const res = await outcome(() =>
			post(section, {
				create: {
					kind: 'figure',
					figureName: 'Sombrero',
					name: 'Basic',
					partner: 'partner',
					style: 'salsa'
				}
			})
		);
		expect(res.status).toBe(200);
		expect(res.body!.linked[0].label).toBe('Sombrero · Basic');
	});

	it('is a 400 with the reason when the figure name is taken', async () => {
		const res = await outcome(() =>
			post(section, {
				create: {
					kind: 'figure',
					figureName: 'Enchufla',
					name: 'Basic',
					partner: 'partner',
					style: 'salsa'
				}
			})
		);
		expect(res).toMatchObject({
			status: 400,
			message: "There's already a figure called Enchufla."
		});
	});

	it.each([
		{},
		'not json',
		{ target: { figureId: 'x' } },
		{ create: { kind: 'song', name: 'x' } },
		{ create: { kind: 'drill', name: 5, everyDays: 3 } }
	])('is a 400 for %o', async (body) => {
		expect((await outcome(() => post(section, body))).status).toBe(400);
	});
});

describe('DELETE /api/video-spots/[id]/links/[linkId]', () => {
	it('keeps the hand link without alsoLesson, and takes it with', async () => {
		linkFigure(db, lessonId, basic);
		const first = linkSpot(db, section, { figureId: basic });
		expect((await outcome(() => del(section, first))).status).toBe(200);
		expect(db.select().from(lessonFigures).all()).toHaveLength(1);
		const second = linkSpot(db, section, { figureId: basic });
		const res = await outcome(() => del(section, second, true));
		expect(res.status).toBe(200);
		expect(res.body!.linked).toEqual([]);
		expect(db.select().from(lessonFigures).all()).toHaveLength(0);
	});

	it("is a 404 for another spot's link", async () => {
		const link = linkSpot(db, other, { figureId: basic });
		expect((await outcome(() => del(section, link))).status).toBe(404);
	});
});
