/**
 * The `leave` action takes the leave sheet's choice: a missing or unknown
 * mode is a 400 and nobody leaves; `chosen` keeps exactly the ticked lesson
 * (plus what the leaver's own rows use). The database is mocked, never set
 * through `process.env` (see CLAUDE.md); a lesson with no files links none.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
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
import { lessons } from '$lib/server/db/schema';
import { roleOf } from '$lib/server/teams';
import { makeClass, type Class } from '$lib/server/test-class';
import { and, eq, isNull } from 'drizzle-orm';
import { listMyLessons } from '$lib/server/lessons';
import { actions } from './+page.server';
import { GET as keepGet } from '../../../api/teams/[id]/keep/+server';

let db: Db;
let c: Class;

beforeEach(async () => {
	envMock.DATA_DIR = await mkdtemp(join(tmpdir(), 'salsa-leave-'));
	db = openDb(':memory:');
	handle.db = db;
	c = makeClass(db);
});
afterEach(async () => {
	await rm(envMock.DATA_DIR, { recursive: true, force: true });
});

const user = (id: string) => ({
	id,
	email: `${id}@x.si`,
	timezone: 'Europe/Ljubljana',
	dance: 'salsa'
});

type Leave = (e: unknown) => Promise<{ status?: number; data?: { message?: string } } | never>;
async function leave(as: string, fields: Record<string, string | string[] | undefined>) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) {
		for (const one of Array.isArray(v) ? v : [v ?? '']) body.append(k, one);
	}
	try {
		return await (actions.leave as unknown as Leave)({
			params: { dance: 'salsa', id: '1' },
			locals: { user: user(as) },
			request: new Request('http://localhost/salsa/groups/1?/leave', { method: 'POST', body })
		});
	} catch (thrown) {
		return thrown as { status?: number; location?: string };
	}
}
const ownLessons = (as: string) =>
	db
		.select()
		.from(lessons)
		.where(and(eq(lessons.userId, as), isNull(lessons.teamId)))
		.all();

describe('the leave action', () => {
	it('refuses a missing or unknown mode with 400 and nobody leaves', async () => {
		for (const fields of [{}, { mode: 'everything' }, { mode: '' }]) {
			const r = await leave('u3', fields);
			expect(r.status).toBe(400);
		}
		expect(roleOf(db, 'u3', 1)).toBe('member');
	});

	it('chosen keeps exactly the ticked lesson', async () => {
		const r = await leave('u3', { mode: 'chosen', lesson: String(c.lesson) });
		expect(r.status).toBe(303);
		expect(roleOf(db, 'u3', 1)).toBeNull();
		expect(ownLessons('u3').map((l) => l.title)).toEqual(['Class']);
	});

	it('marks the kept lesson in the Lessons list as a copy of the group’s', async () => {
		const wall = { userId: 'u3', dance: 'salsa' as const };
		expect(listMyLessons(db, wall).map((l) => l.copyOf)).toEqual([null]);
		await leave('u3', { mode: 'chosen', lesson: String(c.lesson) });
		const rows = listMyLessons(db, wall);
		expect(rows.map((l) => [l.title, l.team, l.copyOf])).toEqual([
			['Class', null, 'Salsa Tuesdays']
		]);
	});

	it('chosen with nothing ticked keeps no lesson', async () => {
		const r = await leave('u3', { mode: 'chosen' });
		expect(r.status).toBe(303);
		expect(ownLessons('u3')).toEqual([]);
	});

	it('used keeps no lesson when the leaver’s routines use none', async () => {
		const r = await leave('u3', { mode: 'used' });
		expect(r.status).toBe(303);
		expect(ownLessons('u3')).toEqual([]);
	});
});

describe('GET /api/teams/[id]/keep', () => {
	const get = async (as: string | null, qs: string, id = '1') => {
		try {
			return (await (keepGet as unknown as (e: unknown) => Response)({
				params: { id },
				locals: { user: as ? user(as) : undefined },
				url: new URL(`http://localhost/api/teams/${id}/keep${qs}`)
			})) as Response;
		} catch (thrown) {
			return thrown as { status: number };
		}
	};

	it('answers a member with the preview, or a choice’s bytes', async () => {
		const preview = await ((await get('u3', '')) as Response).json();
		expect(preview.lessons.map((l: { id: number }) => l.id)).toEqual([c.lesson]);
		expect(typeof preview.allBytes).toBe('number');
		const chosen = await ((await get('u3', `?mode=chosen&lesson=${c.lesson}`)) as Response).json();
		expect(chosen.bytes).toBeGreaterThanOrEqual(0);
		expect((await get('u3', '?mode=nope')).status).toBe(400);
	});

	it('is a 404 for someone outside the group', async () => {
		expect((await get('u4', '')).status).toBe(404);
		expect((await get('u4', '?mode=all')).status).toBe(404);
		expect((await get(null, '')).status).toBe(401);
	});
});
