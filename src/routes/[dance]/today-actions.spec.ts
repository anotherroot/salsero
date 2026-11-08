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
import { exercises, sets, todayPicks, users } from '$lib/server/db/schema';
import { noonOf } from '$lib/day/day';
import { createCustomExercise } from '$lib/server/exercises';
import { dayInputOf, setDailyCount } from '$lib/server/today-picks';
import { dayList } from '$lib/schedule/today-list';
import { undoAddSteps } from '$lib/schedule/picks';
import { U1_SALSA } from '$lib/server/test-walls';
import { runInLocale } from '$lib/server/i18n-request';
import { actions } from './(today)/+page.server';

const U1 = {
	id: 'u1',
	email: 'u1@example.com',
	timezone: 'Europe/Ljubljana',
	dance: 'salsa',
	isAdmin: true
};
const U2 = {
	id: 'u2',
	email: 'u2@example.com',
	timezone: 'Europe/Ljubljana',
	dance: 'salsa',
	isAdmin: false
};
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
type Result = {
	status?: number;
	data?: { message?: string };
	pickIds?: number[];
	unskipped?: number[];
	exerciseIds?: number[];
	action?: string;
};
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
		expect(r).toEqual({ action: 'pick', pickIds: [expect.any(Number)], unskipped: [] });
		expect(allPicks().map((p) => [p.exerciseId, p.kind])).toEqual([[a, 'add']]);
		await call('pick', U1, { exerciseId: String(a), kind: 'skip' });
		expect(allPicks().map((p) => [p.exerciseId, p.kind])).toEqual([
			[a, 'add'],
			[a, 'skip']
		]);
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
		// What the page focuses: the first of the rows it adds.
		expect(r.exerciseIds).toEqual(ids.slice(5, 10));
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

describe('Not today and its Undo, end to end', () => {
	const rows = () =>
		dayList(dayInputOf(db, U1_SALSA, 'Europe/Ljubljana', Date.now())).rows.map(
			(r) => `${r.exercise.name}:${r.kind}`
		);
	const kinds = () => allPicks().map((p) => p.kind);

	it('skipping a queue row moves the next up; Undo puts it back', async () => {
		setDailyCount(db, 'u1', 1);
		const a = make('a');
		make('b');
		const before = rows();
		expect(before).toEqual(['a:todo']);
		const skip = await call('pick', U1, { exerciseId: String(a), kind: 'skip' });
		expect(skip.pickIds).toHaveLength(1);
		expect(rows()).toEqual(['b:todo']);
		await call('unpick', U1, { pickId: String(skip.pickIds![0]) });
		expect(rows()).toEqual(before);
	});

	it('skipping a next-picked row hides it; Undo brings it back picked, pick intact', async () => {
		setDailyCount(db, 'u1', 1);
		make('a');
		const b = make('b');
		await call('next', U1);
		const before = rows();
		expect(before).toEqual(['a:todo', 'b:picked']);
		const pickKinds = kinds();
		const skip = await call('pick', U1, { exerciseId: String(b), kind: 'skip' });
		expect(rows()).toEqual(['a:todo']);
		expect(kinds()).toHaveLength(pickKinds.length + 1);
		await call('unpick', U1, { pickId: String(skip.pickIds![0]) });
		expect(kinds()).toEqual(pickKinds);
		expect(rows()).toEqual(before);
	});

	it('skipping an add-picked row hides it; Undo brings it back picked', async () => {
		const a = make('a');
		await call('pick', U1, { exerciseId: String(a), kind: 'add' });
		const before = rows();
		const skip = await call('pick', U1, { exerciseId: String(a), kind: 'skip' });
		expect(kinds().sort()).toEqual(['add', 'skip']);
		expect(rows()).toEqual([]);
		await call('unpick', U1, { pickId: String(skip.pickIds![0]) });
		expect(kinds()).toEqual(['add']);
		expect(rows()).toEqual(before);
	});
});

describe("Coming up's + on a skipped row, and its Undo", () => {
	const rows = () =>
		dayList(dayInputOf(db, U1_SALSA, 'Europe/Ljubljana', Date.now())).rows.map(
			(r) => `${r.exercise.name}:${r.kind}`
		);
	const kinds = () => allPicks().map((p) => `${p.exerciseId}:${p.kind}`);
	/** Undo as the layout runs it: each step through the actions, in order. */
	const undo = async (exerciseId: number, reply: Result) => {
		for (const step of undoAddSteps(exerciseId, reply))
			await call(
				step.action,
				U1,
				Object.fromEntries(Object.entries(step.fields).map(([k, v]) => [k, String(v)]))
			);
	};

	it('+ after skipping a next-picked row brings it back', async () => {
		setDailyCount(db, 'u1', 1);
		make('a');
		const b = make('b');
		await call('next', U1);
		const before = rows();
		expect(before).toEqual(['a:todo', 'b:picked']);
		await call('pick', U1, { exerciseId: String(b), kind: 'skip' });
		expect(rows()).toEqual(['a:todo']);
		const plus = await call('pick', U1, { exerciseId: String(b), kind: 'add' });
		expect(plus.unskipped).toEqual([b]);
		expect(rows()).toEqual(before);
	});

	it('+ after skipping an add-picked row brings it back', async () => {
		const a = make('a');
		await call('pick', U1, { exerciseId: String(a), kind: 'add' });
		const before = rows();
		await call('pick', U1, { exerciseId: String(a), kind: 'skip' });
		expect(rows()).toEqual([]);
		const plus = await call('pick', U1, { exerciseId: String(a), kind: 'add' });
		expect(plus).toEqual({ action: 'pick', pickIds: [], unskipped: [a] });
		expect(rows()).toEqual(before);
	});

	it('Undo of + on a skipped row skips it again', async () => {
		setDailyCount(db, 'u1', 1);
		const a = make('a');
		make('b');
		const c = make('c');
		// A queue row skipped: + makes an add pick and takes the skip; Undo restores exactly.
		await call('pick', U1, { exerciseId: String(a), kind: 'skip' });
		const skippedRows = rows();
		const skippedPicks = kinds();
		const plus = await call('pick', U1, { exerciseId: String(a), kind: 'add' });
		expect(rows()).toContain('a:todo');
		await undo(a, plus);
		expect(rows()).toEqual(skippedRows);
		expect(kinds()).toEqual([`${a}:skip`]);
		expect(skippedPicks).toEqual([`${a}:skip`]);
		// A next-picked row skipped: + only takes the skip; Undo skips it again.
		await call('next', U1);
		await call('pick', U1, { exerciseId: String(c), kind: 'skip' });
		const hidden = rows();
		expect(hidden).toEqual(['b:todo']);
		const again = await call('pick', U1, { exerciseId: String(c), kind: 'add' });
		expect(again).toEqual({ action: 'pick', pickIds: [], unskipped: [c] });
		expect(rows()).toEqual(['b:todo', 'c:picked']);
		await undo(c, again);
		expect(rows()).toEqual(hidden);
		// The next pick stayed through it all; the skip is back.
		expect(kinds().filter((k) => k.startsWith(`${c}:`))).toEqual([`${c}:next`, `${c}:skip`]);
	});

	it('+ on a row that was not skipped: Undo takes the pick away', async () => {
		setDailyCount(db, 'u1', 1);
		make('a');
		const b = make('b');
		const plus = await call('pick', U1, { exerciseId: String(b), kind: 'add' });
		expect(rows()).toEqual(['a:todo', 'b:picked']);
		expect(undoAddSteps(b, plus)).toEqual([
			{ action: 'unpick', fields: { pickId: plus.pickIds![0] } }
		]);
		await undo(b, plus);
		expect(allPicks()).toEqual([]);
		expect(rows()).toEqual(['a:todo']);
	});
});

// The hook runs every action in the person's language (`runInLocale` around resolve).
// Catches: a refusal left in English for someone who reads none.
describe('refusals in Slovenian', () => {
	const sl = <T>(fn: () => Promise<T>) => runInLocale('sl', fn);

	it('pick, unpick, next and New exercise say why in Slovenian', async () => {
		const a = make('a');
		expect(
			(await sl(() => call('pick', U1, { exerciseId: String(a), kind: 'x' }))).data?.message
		).toBe('Izberite vajo, ki jo želite dodati ali preskočiti.');
		expect(
			(await sl(() => call('pick', U2, { exerciseId: String(a), kind: 'add' }))).data?.message
		).toBe('Te vaje ni.');
		db.update(exercises).set({ active: false }).where(eq(exercises.id, a)).run();
		expect(
			(await sl(() => call('pick', U1, { exerciseId: String(a), kind: 'add' }))).data?.message
		).toBe('Ta vaja je na premoru.');
		db.update(exercises).set({ archivedAt: Date.now() }).where(eq(exercises.id, a)).run();
		expect(
			(await sl(() => call('pick', U1, { exerciseId: String(a), kind: 'skip' }))).data?.message
		).toBe('Ta vaja je arhivirana.');
		expect((await sl(() => call('unpick', U1, {}))).data?.message).toBe('Te izbire ni.');
		expect((await sl(() => call('next', U1))).data?.message).toBe(
			'Za danes ni več ničesar za dodati.'
		);
		expect((await sl(() => call('createExercise', U1, { name: '' }))).data?.message).toBe(
			'Vpišite ime (do 200 znakov).'
		);
		expect(allPicks()).toEqual([]);
	});

	it('and in English', async () => {
		expect((await call('unpick', U1, {})).data?.message).toBe('No such pick.');
		expect((await call('next', U1)).data?.message).toBe('Nothing left to add today.');
		expect((await call('createExercise', U1, { name: '' })).data?.message).toBe(
			'Give it a name (up to 200 characters).'
		);
	});
});

describe('done and undoDone', () => {
	const rows = () => db.select().from(sets).all();

	it('done saves a day, undoDone with its before restores the first save', async () => {
		const a = make('a');
		const first = await call('done', U1, { exerciseId: String(a), rating: '3', note: 'x' });
		expect(first).toMatchObject({ action: 'done', ok: true, before: null });
		const second = (await call('done', U1, { exerciseId: String(a), rating: '4' })) as unknown as {
			setId: number;
			before: string;
		};
		expect(rows()).toMatchObject([{ rating: 4 }]);
		const undo = await call('undoDone', U1, { setId: String(second.setId), before: second.before });
		expect(undo).toMatchObject({ action: 'undoDone', ok: true });
		expect(rows()).toMatchObject([{ rating: 3, note: 'x' }]);
	});

	it('done with a past day backfills it at noon', async () => {
		const a = make('a');
		await call('done', U1, { exerciseId: String(a), rating: '4', day: '2026-11-05' });
		expect(rows()).toMatchObject([{ doneAt: noonOf('2026-11-05', 'Europe/Ljubljana') }]);
	});

	it("done on another person's exercise is a 404, undoDone on their set too", async () => {
		const a = make('a');
		await expect(call('done', U2, { exerciseId: String(a), rating: '4' })).rejects.toMatchObject({
			status: 404
		});
		const saved = (await call('done', U1, { exerciseId: String(a), rating: '4' })) as unknown as {
			setId: number;
		};
		await expect(
			call('undoDone', U2, { setId: String(saved.setId), before: '' })
		).rejects.toMatchObject({ status: 404 });
		expect(rows()).toHaveLength(1);
	});
});
