import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { openDb, type Db } from './db';
import { exercises } from './db/schema';
import { createCustomExercise } from './exercises';
import { setWarmupOrder } from './warmup-order';
import { CLASS_ED, makeClass } from './test-class';
import { U1_BACHATA, U1_SALSA, U2_SALSA } from './test-walls';
import type { Space } from './scope';

let db: Db;
beforeEach(() => {
	db = openDb(':memory:');
});

const warm = (space: Space, name: string, order: number | null = null) => {
	const e = createCustomExercise(db, space, { name, notes: null, warmup: true });
	if (order !== null)
		db.update(exercises).set({ warmupOrder: order }).where(eq(exercises.id, e.id)).run();
	return e.id;
};
const orderOf = (id: number) =>
	db.select({ o: exercises.warmupOrder }).from(exercises).where(eq(exercises.id, id)).get()!.o;

describe('setWarmupOrder', () => {
	it('writes 1..n in the posted order', () => {
		const a = warm(U1_SALSA, 'A');
		const b = warm(U1_SALSA, 'B');
		const c = warm(U1_SALSA, 'C');
		expect(setWarmupOrder(db, U1_SALSA, [c, a, b])).toBe(true);
		expect([orderOf(c), orderOf(a), orderOf(b)]).toEqual([1, 2, 3]);
	});

	it('puts the warm-ups that were not posted after, in their current order', () => {
		const a = warm(U1_SALSA, 'A', 1);
		const hidden2 = warm(U1_SALSA, 'H2', 5);
		const b = warm(U1_SALSA, 'B', 2);
		const hidden1 = warm(U1_SALSA, 'H1', 3);
		const unplaced = warm(U1_SALSA, 'U'); // null order, after the placed ones
		expect(setWarmupOrder(db, U1_SALSA, [b, a])).toBe(true);
		const all = [b, a, hidden1, hidden2, unplaced].map(orderOf);
		expect(all).toEqual([1, 2, 3, 4, 5]);
	});

	it('refuses an empty or repeating list', () => {
		const a = warm(U1_SALSA, 'A', 1);
		expect(setWarmupOrder(db, U1_SALSA, [])).toBe(false);
		expect(setWarmupOrder(db, U1_SALSA, [a, a])).toBe(false);
		expect(orderOf(a)).toBe(1);
	});

	it('refuses another person, another dance, a group row, a non-warm-up, an archived one, and writes nothing', () => {
		const a = warm(U1_SALSA, 'A', 1);
		const b = warm(U1_SALSA, 'B', 2);
		const theirs = warm(U2_SALSA, 'T', 7);
		const bachata = warm(U1_BACHATA, 'X', 8);
		const plain = createCustomExercise(db, U1_SALSA, { name: 'P', notes: null }).id;
		const gone = warm(U1_SALSA, 'G', 9);
		db.update(exercises).set({ archivedAt: 1 }).where(eq(exercises.id, gone)).run();
		makeClass(db);
		const group = createCustomExercise(db, CLASS_ED, { name: 'Gr', notes: null }).id;
		db.update(exercises).set({ warmup: true, warmupOrder: 4 }).where(eq(exercises.id, group)).run();

		for (const bad of [theirs, bachata, plain, gone, group, 9999]) {
			expect(setWarmupOrder(db, U1_SALSA, [b, bad, a])).toBe(false);
		}
		expect([orderOf(a), orderOf(b), orderOf(theirs), orderOf(group), orderOf(plain)]).toEqual([
			1,
			2,
			7,
			4,
			null
		]);
	});
});
