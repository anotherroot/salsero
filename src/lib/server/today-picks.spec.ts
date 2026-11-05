import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises, users } from './db/schema';
import { createCustomExercise } from './exercises';
import {
	DAILY_DEFAULT,
	PickRefused,
	addPicks,
	dailyCountOf,
	picksFor,
	removePick,
	setDailyCount
} from './today-picks';
import { U1_BACHATA, U1_SALSA, U2_SALSA } from './test-walls';

const DAY = '2026-11-05';
const NOW = 1_762_300_000_000;

let db: Db;
const make = (wall = U1_SALSA, name = 'Basic') =>
	createCustomExercise(db, wall, { name, everyDays: 3, notes: null }).id;

beforeEach(() => {
	db = openDb(':memory:');
	for (const id of ['u1', 'u2']) {
		db.insert(users)
			.values({ id, email: `${id}@x.test`, passwordHash: 'x' })
			.run();
	}
});

describe('the daily number', () => {
	it('defaults to 5 and clamps into 1 to 30', () => {
		expect(dailyCountOf(db, 'u1')).toBe(DAILY_DEFAULT);
		expect(setDailyCount(db, 'u1', 12)).toBe(12);
		expect(dailyCountOf(db, 'u1')).toBe(12);
		expect(setDailyCount(db, 'u1', 0)).toBe(1);
		expect(setDailyCount(db, 'u1', 99)).toBe(30);
		expect(dailyCountOf(db, 'u1')).toBe(30);
		expect(dailyCountOf(db, 'u2')).toBe(5);
	});

	it('refuses a non-number', () => {
		expect(() => setDailyCount(db, 'u1', NaN)).toThrow(RangeError);
	});
});

describe('addPicks', () => {
	it('stores a pick the wall can read back', () => {
		const a = make();
		const { created: ids, unskipped } = addPicks(db, U1_SALSA, [a], DAY, 'add', NOW);
		expect(ids).toHaveLength(1);
		expect(unskipped).toEqual([]);
		expect(picksFor(db, U1_SALSA, DAY)).toEqual([
			{ id: ids[0], exerciseId: a, kind: 'add', createdAt: NOW }
		]);
		expect(picksFor(db, U1_SALSA, '2026-11-06')).toEqual([]);
		expect(picksFor(db, U1_BACHATA, DAY)).toEqual([]);
	});

	it('ignores an exercise already picked today', () => {
		const a = make();
		addPicks(db, U1_SALSA, [a], DAY, 'add', NOW);
		const none = { created: [], unskipped: [] };
		expect(addPicks(db, U1_SALSA, [a], DAY, 'add', NOW)).toEqual(none);
		expect(addPicks(db, U1_SALSA, [a], DAY, 'next', NOW)).toEqual(none);
		expect(picksFor(db, U1_SALSA, DAY)).toHaveLength(1);
	});

	it('refuses a paused or archived exercise, writing nothing', () => {
		const ok = make(U1_SALSA, 'Ok');
		const paused = make(U1_SALSA, 'Paused');
		const archived = make(U1_SALSA, 'Archived');
		db.update(exercises).set({ active: false }).where(eq(exercises.id, paused)).run();
		db.update(exercises).set({ archivedAt: NOW }).where(eq(exercises.id, archived)).run();
		expect(() => addPicks(db, U1_SALSA, [ok, paused], DAY, 'add', NOW)).toThrow(PickRefused);
		expect(() => addPicks(db, U1_SALSA, [archived], DAY, 'next', NOW)).toThrow(PickRefused);
		expect(() => addPicks(db, U1_SALSA, [archived], DAY, 'skip', NOW)).toThrow(PickRefused);
		expect(picksFor(db, U1_SALSA, DAY)).toEqual([]);
		// a paused exercise may still be skipped
		expect(addPicks(db, U1_SALSA, [paused], DAY, 'skip', NOW).created).toHaveLength(1);
	});

	it("refuses another person's or the other dance's exercise", () => {
		const theirs = make(U2_SALSA);
		const bachata = make(U1_BACHATA);
		expect(() => addPicks(db, U1_SALSA, [theirs], DAY, 'add', NOW)).toThrow(PickRefused);
		expect(() => addPicks(db, U1_SALSA, [bachata], DAY, 'add', NOW)).toThrow(PickRefused);
		expect(() => addPicks(db, U1_SALSA, [999], DAY, 'add', NOW)).toThrow(PickRefused);
	});

	it('a skip keeps the add/next pick; an add/next takes the skip away', () => {
		const a = make();
		addPicks(db, U1_SALSA, [a], DAY, 'add', NOW);
		addPicks(db, U1_SALSA, [a], DAY, 'skip', NOW);
		expect(picksFor(db, U1_SALSA, DAY).map((p) => p.kind)).toEqual(['add', 'skip']);
		expect(addPicks(db, U1_SALSA, [a], DAY, 'skip', NOW).created).toEqual([]);
		const b = make(U1_SALSA, 'B');
		addPicks(db, U1_SALSA, [b], DAY, 'skip', NOW);
		expect(addPicks(db, U1_SALSA, [b], DAY, 'next', NOW)).toEqual({
			created: [expect.any(Number)],
			unskipped: [b]
		});
		expect(
			picksFor(db, U1_SALSA, DAY)
				.filter((p) => p.exerciseId === b)
				.map((p) => p.kind)
		).toEqual(['next']);
	});

	it('an add/next on one already picked still takes its skip away, and says so', () => {
		const a = make();
		addPicks(db, U1_SALSA, [a], DAY, 'next', NOW);
		addPicks(db, U1_SALSA, [a], DAY, 'skip', NOW);
		// No second pick (the next one stays); the skip goes.
		expect(addPicks(db, U1_SALSA, [a], DAY, 'add', NOW)).toEqual({ created: [], unskipped: [a] });
		expect(picksFor(db, U1_SALSA, DAY).map((p) => p.kind)).toEqual(['next']);
	});

	it('picks several at once and each exactly once', () => {
		const a = make(U1_SALSA, 'A');
		const b = make(U1_SALSA, 'B');
		expect(addPicks(db, U1_SALSA, [a, b, a], DAY, 'next', NOW).created).toHaveLength(2);
	});
});

describe('removePick', () => {
	it('removes within the wall only', () => {
		const a = make();
		const [id] = addPicks(db, U1_SALSA, [a], DAY, 'add', NOW).created;
		expect(removePick(db, U2_SALSA, id)).toBe(false);
		expect(removePick(db, U1_BACHATA, id)).toBe(false);
		expect(picksFor(db, U1_SALSA, DAY)).toHaveLength(1);
		expect(removePick(db, U1_SALSA, id)).toBe(true);
		expect(removePick(db, U1_SALSA, id)).toBe(false);
		expect(picksFor(db, U1_SALSA, DAY)).toEqual([]);
	});
});
