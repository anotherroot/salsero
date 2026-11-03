import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { lessons, opens } from '$lib/server/db/schema';
import { createTeam, joinTeam } from '$lib/server/teams';
import { createLesson } from '$lib/server/lessons';
import { T1_SALSA, U2_SALSA } from '$lib/server/test-walls';
import { POST } from './+server';

let db: Db;
const input = { lessonDay: '2026-11-01', title: 'C', notes: null };

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	createTeam(db, 'u1', 'salsa', 'Class', 1);
	joinTeam(db, 'u2', 1, 2);
});

async function post(user: string | null, body: unknown): Promise<number> {
	const request = new Request('http://x/api/opens', {
		method: 'POST',
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});
	try {
		const res = await (POST as (e: unknown) => Promise<Response>)({
			request,
			locals: { user: user ? { id: user } : null }
		});
		return res.status;
	} catch (e) {
		return (e as { status: number }).status;
	}
}
const rows = () => db.select().from(opens).all();
const publish = (id: number) =>
	db.update(lessons).set({ publishedAt: 5 }).where(eq(lessons.id, id)).run();

describe('POST /api/opens', () => {
	it('a member opening a published group lesson is recorded', async () => {
		const id = createLesson(db, T1_SALSA, input).lesson.id;
		publish(id);
		expect(await post('u2', { kind: 'lesson', id })).toBe(204);
		expect(rows()).toHaveLength(1);
		expect(rows()[0]).toMatchObject({ userId: 'u2', kind: 'lesson', itemId: id });
	});

	it('a draft as a member is 404 and records nothing', async () => {
		const id = createLesson(db, T1_SALSA, input).lesson.id;
		expect(await post('u2', { kind: 'lesson', id })).toBe(404);
		expect(rows()).toHaveLength(0);
	});

	it('an outsider is 404', async () => {
		const id = createLesson(db, T1_SALSA, input).lesson.id;
		publish(id);
		expect(await post('u3', { kind: 'lesson', id })).toBe(404);
		expect(rows()).toHaveLength(0);
	});

	it("a person's own lesson is 404 and records nothing", async () => {
		const id = createLesson(db, U2_SALSA, input).lesson.id;
		expect(await post('u2', { kind: 'lesson', id })).toBe(404);
		expect(rows()).toHaveLength(0);
	});

	it('a bad body is 400, no session is 401', async () => {
		expect(await post('u2', 'nope')).toBe(400);
		expect(await post('u2', { kind: 'song', id: 1 })).toBe(400);
		expect(await post('u2', { kind: 'lesson', id: 'x' })).toBe(400);
		expect(await post(null, { kind: 'lesson', id: 1 })).toBe(401);
	});
});
