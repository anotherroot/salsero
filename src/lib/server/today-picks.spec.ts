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
		const ids = addPicks(db, U1_SALSA, [a], DAY, 'add', NOW);
		expect(ids).toHaveLength(1);
		expect(picksFor(db, U1_SALSA, DAY)).toEqual([
			{ id: ids[0], exerciseId: a, kind: 'add', createdAt: NOW }
		]);
		expect(picksFor(db, U1_SALSA, '2026-11-06')).toEqual([]);
		expect(picksFor(db, U1_BACHATA, DAY)).toEqual([]);
	});

	it('ignores an exercise already picked today', () => {
		const a = make();
		addPicks(db, U1_SALSA, [a], DAY, 'add', NOW);
		expect(addPicks(db, U1_SALSA, [a], DAY, 'add', NOW)).toEqual([]);
		expect(addPicks(db, U1_SALSA, [a], DAY, 'next', NOW)).toEqual([]);
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
		expect(addPicks(db, U1_SALSA, [paused], DAY, 'skip', NOW)).toHaveLength(1);
	});

	it("refuses another person's or the other dance's exercise", () => {
		const theirs = make(U2_SALSA);
		const bachata = make(U1_BACHATA);
		expect(() => addPicks(db, U1_SALSA, [theirs], DAY, 'add', NOW)).toThrow(PickRefused);
		expect(() => addPicks(db, U1_SALSA, [bachata], DAY, 'add', NOW)).toThrow(PickRefused);
		expect(() => addPicks(db, U1_SALSA, [999], DAY, 'add', NOW)).toThrow(PickRefused);
	});

	it('skip and add replace each other', () => {
		const a = make();
		addPicks(db, U1_SALSA, [a], DAY, 'add', NOW);
		addPicks(db, U1_SALSA, [a], DAY, 'skip', NOW);
		expect(picksFor(db, U1_SALSA, DAY).map((p) => p.kind)).toEqual(['skip']);
		addPicks(db, U1_SALSA, [a], DAY, 'next', NOW);
		expect(picksFor(db, U1_SALSA, DAY).map((p) => p.kind)).toEqual(['next']);
		addPicks(db, U1_SALSA, [a], DAY, 'skip', NOW);
		expect(addPicks(db, U1_SALSA, [a], DAY, 'skip', NOW)).toEqual([]);
		expect(picksFor(db, U1_SALSA, DAY).map((p) => p.kind)).toEqual(['skip']);
	});

	it('picks several at once and each exactly once', () => {
		const a = make(U1_SALSA, 'A');
		const b = make(U1_SALSA, 'B');
		expect(addPicks(db, U1_SALSA, [a, b, a], DAY, 'next', NOW)).toHaveLength(2);
	});
});

describe('removePick', () => {
	it('removes within the wall only', () => {
		const a = make();
		const [id] = addPicks(db, U1_SALSA, [a], DAY, 'add', NOW);
		expect(removePick(db, U2_SALSA, id)).toBe(false);
		expect(removePick(db, U1_BACHATA, id)).toBe(false);
		expect(picksFor(db, U1_SALSA, DAY)).toHaveLength(1);
		expect(removePick(db, U1_SALSA, id)).toBe(true);
		expect(removePick(db, U1_SALSA, id)).toBe(false);
		expect(picksFor(db, U1_SALSA, DAY)).toEqual([]);
	});
});
