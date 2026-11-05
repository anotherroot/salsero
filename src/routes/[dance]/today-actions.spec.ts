/**
 * Today's pick actions as a route sees them: `pick` (add | skip), `unpick` and
 * `next`. The data functions have their own spec (`today-picks.spec.ts`); this
 * one checks what the actions add on top: the kind check, a refusal as a 400
 * with its message, the owner wall, and Next N taking the next ones in line.
 *
 * Like `dance-wall.spec.ts`, `getDb()` is mocked: each test gets its own
 * `openDb(':memory:')` and nothing ever opens the real database.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const handle = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock('$lib/server/db', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/db')>('$lib/server/db');
	return { ...actual, getDb: () => handle.db };
});

import { eq } from 'drizzle-orm';
import { openDb, type Db } from '$lib/server/db';
import { exercises, todayPicks, users } from '$lib/server/db/schema';
import { createCustomExercise } from '$lib/server/exercises';
import { setDailyCount } from '$lib/server/today-picks';
import { U1_SALSA } from '$lib/server/test-walls';
import { actions } from './(today)/+page.server';

const U1 = { id: 'u1', email: 'u1@example.com', timezone: 'Europe/Ljubljana', isAdmin: true };
const U2 = { id: 'u2', email: 'u2@example.com', timezone: 'Europe/Ljubljana', isAdmin: false };
type User = typeof U1;

let db: Db;

function post(user: User, fields: Record<string, string>) {
	return {
		params: { dance: 'salsa' },
		request: new Request('http://localhost/', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields)
		}),
		locals: { user }
	};
}
type Result = { status?: number; data?: { message?: string }; pickIds?: number[]; action?: string };
const call = (name: keyof typeof actions, user: User, fields: Record<string, string> = {}) =>
	(actions[name] as unknown as (e: unknown) => Promise<Result>)(post(user, fields));

const make = (name: string) =>
	createCustomExercise(db, U1_SALSA, { name, everyDays: 3, notes: null }).id;
const allPicks = () => db.select().from(todayPicks).all();

beforeEach(() => {
	db = openDb(':memory:');
	handle.db = db;
	for (const id of ['u1', 'u2'])
		db.insert(users)
			.values({ id, email: `${id}@x.test`, passwordHash: 'x' })
			.run();
});

describe('pick', () => {
	it('adds and skips', async () => {
		const a = make('a');
		const r = await call('pick', U1, { exerciseId: String(a), kind: 'add' });
		expect(r).toEqual({ action: 'pick', pickIds: [expect.any(Number)] });
		expect(allPicks().map((p) => [p.exerciseId, p.kind])).toEqual([[a, 'add']]);
		await call('pick', U1, { exerciseId: String(a), kind: 'skip' });
		expect(allPicks().map((p) => [p.exerciseId, p.kind])).toEqual([[a, 'skip']]);
	});

	it('refuses kind next and an unknown kind with a 400, writing nothing', async () => {
		const a = make('a');
		for (const kind of ['next', 'bogus', '']) {
			const r = await call('pick', U1, { exerciseId: String(a), kind });
			expect(r.status).toBe(400);
		}
		expect(allPicks()).toEqual([]);
	});

	it('turns a refusal into a 400 with its message', async () => {
		const a = make('a');
		db.update(exercises).set({ active: false }).where(eq(exercises.id, a)).run();
		const r = await call('pick', U1, { exerciseId: String(a), kind: 'add' });
		expect(r.status).toBe(400);
		expect(r.data?.message).toBe('That exercise is paused.');
		expect(allPicks()).toEqual([]);
	});

	it("refuses another person's exercise, writing nothing", async () => {
		const a = make('a');
		for (const kind of ['add', 'skip']) {
			const r = await call('pick', U2, { exerciseId: String(a), kind });
			expect(r.status).toBe(400);
			expect(r.data?.message).toBe('No such exercise.');
		}
		expect(allPicks()).toEqual([]);
	});
});

describe('unpick', () => {
	it('takes a pick away', async () => {
		const a = make('a');
		const { pickIds } = await call('pick', U1, { exerciseId: String(a), kind: 'add' });
		await call('unpick', U1, { pickId: String(pickIds![0]) });
		expect(allPicks()).toEqual([]);
	});

	it("leaves another person's pick alone", async () => {
		const a = make('a');
		const { pickIds } = await call('pick', U1, { exerciseId: String(a), kind: 'add' });
		await call('unpick', U2, { pickId: String(pickIds![0]) });
		expect(allPicks()).toHaveLength(1);
	});
});

describe('next', () => {
	const twelve = () =>
		Array.from({ length: 12 }, (_, i) => make(`E${String(i + 1).padStart(2, '0')}`));

	it('picks the daily number of the next ones in line', async () => {
		const ids = twelve();
		const r = await call('next', U1);
		expect(r.action).toBe('next');
		expect(r.pickIds).toHaveLength(5);
		// The day's rows are the first five; Next takes the five after them.
		expect(allPicks().map((p) => p.exerciseId)).toEqual(ids.slice(5, 10));
		expect(allPicks().every((p) => p.kind === 'next')).toBe(true);
	});

	it('next twice picks distinct exercises', async () => {
		const ids = twelve();
		const first = await call('next', U1);
		const second = await call('next', U1);
		expect(first.pickIds).toHaveLength(5);
		expect(second.pickIds).toHaveLength(2);
		const picked = allPicks().map((p) => p.exerciseId);
		expect(new Set(picked).size).toBe(picked.length);
		expect(picked).toEqual(ids.slice(5));
	});

	it('uses the daily number', async () => {
		twelve();
		setDailyCount(db, 'u1', 2);
		expect((await call('next', U1)).pickIds).toHaveLength(2);
	});

	it('refuses with a 400 when nothing is left to pull', async () => {
		make('a');
		const r = await call('next', U1);
		expect(r.status).toBe(400);
		expect(r.data?.message).toBeTruthy();
		expect(allPicks()).toEqual([]);
	});

	it("never picks another person's exercises", async () => {
		twelve();
		const r = await call('next', U2);
		expect(r.status).toBe(400);
		expect(allPicks()).toEqual([]);
	});
});
