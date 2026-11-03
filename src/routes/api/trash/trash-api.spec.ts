/**
 * A group's section from the player: its delete returns the trash entry, a
 * save that arrives after it is told who deleted it (410), Undo restores the
 * same section through `/api/trash/[id]` (risk 18), and "Archived by" offers
 * Restore through `/api/archived`. `getDb()` is mocked, as everywhere.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users, videoSpots } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { setRole } from '$lib/server/membership';
import { addLessonVideo, createLesson } from '$lib/server/lessons';
import { addSpot } from '$lib/server/spots';
import { archiveVariation, createFigure } from '$lib/server/figures';
import { T1_SALSA } from '$lib/server/test-walls';
import * as spot from '../video-spots/[id]/+server';
import * as trash from './[id]/+server';
import * as archived from '../archived/+server';

let db: Db;
let spotId: number;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
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
	const lesson = createLesson(db, T1_SALSA, { lessonDay: '2026-11-01', title: 'C', notes: null })
		.lesson.id;
	const video = addLessonVideo(
		db,
		{ lessonId: lesson, file: 'a.mp4', mime: 'video/mp4', sizeBytes: 5 },
		'u1'
	).id;
	spotId = addSpot(
		db,
		{ lessonVideoId: video },
		{ startMs: 0, endMs: 4000, label: 'Enchufla doble' },
		'u1'
	)!.id;
});

type Handler = (event: unknown) => Promise<Response> | Response;
const as = (uid: string) => ({ user: { id: uid, isAdmin: false, timezone: 'UTC' } });
const run = (h: unknown, uid: string, event: object) =>
	(h as Handler)({ locals: as(uid), ...event });
async function status(p: () => Promise<Response> | Response): Promise<number> {
	try {
		return (await p()).status;
	} catch (e) {
		return (e as { status: number }).status;
	}
}
const json = (method: string, body: unknown) =>
	new Request('http://localhost/x', {
		method,
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

describe('a group section in the player', () => {
	it('delete returns its trash entry; a save after it is a 410 naming who; Undo brings the same id back', async () => {
		const params = { id: String(spotId) };
		const gone = await run(spot.DELETE, 'u2', { params });
		const { trashId } = await gone.json();
		expect(trashId).toBeTypeOf('number');

		const late = await run(spot.PATCH, 'u1', {
			params,
			request: json('PATCH', { label: 'X', seen: { label: 'Enchufla doble' } })
		});
		expect(late.status).toBe(410);
		expect(await late.json()).toMatchObject({ message: 'Luka deleted this · just now' });
		// A member is not told: the stranger's 404.
		expect(
			await status(() => run(spot.PATCH, 'u3', { params, request: json('PATCH', { label: 'X' }) }))
		).toBe(404);

		// Undo: a member may not; an editor brings the same section back.
		expect(await status(() => run(trash.POST, 'u3', { params: { id: String(trashId) } }))).toBe(
			404
		);
		const back = await run(trash.POST, 'u1', { params: { id: String(trashId) } });
		expect(back.status).toBe(200);
		expect(db.select({ id: videoSpots.id }).from(videoSpots).all()).toEqual([{ id: spotId }]);
		// Twice is a refusal with its words, not a twin.
		const again = await run(trash.POST, 'u1', { params: { id: String(trashId) } });
		expect(again.status).toBe(409);
		expect(await again.json()).toEqual({ message: 'This is back already.' });
	});
});

describe('/api/archived', () => {
	it('restores a group variation archived since, for its editors only', async () => {
		const fig = createFigure(db, T1_SALSA, {
			figureName: 'Enchufla',
			name: 'Basic',
			partner: 'partner',
			style: 'salsa',
			notes: null
		})!;
		archiveVariation(db, fig.figure.id, Date.now(), 'u1');
		const body = { figureId: fig.figure.id };
		expect(await status(() => run(archived.POST, 'u3', { request: json('POST', body) }))).toBe(404);
		const done = await run(archived.POST, 'u2', { request: json('POST', body) });
		expect(done.status).toBe(200);
		expect(await status(() => run(archived.POST, 'u2', { request: json('POST', body) }))).toBe(404);
	});
});
