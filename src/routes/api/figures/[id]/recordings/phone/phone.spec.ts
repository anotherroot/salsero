/**
 * The phone-only adds (offline phase 4c), called as SvelteKit would call them.
 * `getDb()` is mocked so no test opens the real database (`dance-wall.spec.ts`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { U1_SALSA, T1_SALSA } from '$lib/server/test-walls';
import type { Space } from '$lib/server/scope';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { openDb, type Db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { createFigure } from '$lib/server/figures';
import { createLesson } from '$lib/server/lessons';
import { createTeam } from '$lib/server/teams';
import { usedBytes } from '$lib/server/storage';
import * as recs from './+server';
import * as vids from '../../../../lessons/[id]/videos/phone/+server';

const FILE = '0a1b2c3d-0000-4000-8000-000000000001.mp4';
const USER = { id: 'u1', email: 'u1@example.com', timezone: 'UTC', isAdmin: false };
let db: Db;

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	db.insert(users).values({ id: 'u1', email: 'u1@x.si', passwordHash: 'x', dance: 'salsa' }).run();
	createTeam(db, 'u1', 'salsa', 'G', 1);
});

type Handler = (event: unknown) => Promise<Response>;
async function post(
	h: unknown,
	id: number,
	body: unknown
): Promise<{ status: number; json?: unknown }> {
	const request = new Request('http://localhost/x', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	try {
		const res = await (h as Handler)({
			params: { id: String(id) },
			request,
			locals: { user: USER }
		});
		return { status: res.status, json: await res.json() };
	} catch (thrown) {
		return { status: (thrown as { status: number }).status };
	}
}
const figure = (space: Space = U1_SALSA) =>
	createFigure(db, space, {
		figureName: 'Enchufla',
		name: 'Basic',
		partner: 'partner',
		style: 'salsa',
		notes: null
	})!.figure.id;
const lesson = (space: Space = U1_SALSA) =>
	createLesson(db, space, { title: 'L', lessonDay: '2026-11-01', notes: null }).lesson.id;
const BODY = { file: FILE, mime: 'video/mp4', sizeBytes: 500 };

describe('POST /api/figures/[id]/recordings/phone', () => {
	it("makes a phone-only recording on the person's own figure", async () => {
		const res = await post(recs.POST, figure(), BODY);
		expect(res.status).toBe(201);
		expect(res.json).toMatchObject({ file: FILE, serverCopy: false, sizeBytes: 500 });
		expect(usedBytes(db, 'u1')).toBe(0);
	});

	it("a group's figure: 404", async () => {
		expect((await post(recs.POST, figure(T1_SALSA), BODY)).status).toBe(404);
	});

	it('a bad file name: 400', async () => {
		expect((await post(recs.POST, figure(), { ...BODY, file: '../x.mp4' })).status).toBe(400);
	});
});

describe('POST /api/lessons/[id]/videos/phone', () => {
	it("makes a phone-only video on the person's own lesson", async () => {
		const res = await post(vids.POST, lesson(), BODY);
		expect(res.status).toBe(201);
		expect(res.json).toMatchObject({ file: FILE, serverCopy: false });
	});

	it("a group's lesson: 404", async () => {
		expect((await post(vids.POST, lesson(T1_SALSA), BODY)).status).toBe(404);
	});

	it('a bad file name: 400', async () => {
		expect((await post(vids.POST, lesson(), { ...BODY, file: 'nope' })).status).toBe(400);
	});
});
