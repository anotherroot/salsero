// Runs under vitest.device.config.ts only: there `better-sqlite3` is the
// shim over SQLite WASM, so `openDb` (migrations included) runs on WASM.
import { describe, expect, it } from 'vitest';
import { openDb } from '$lib/server/db';
import { exercises } from '$lib/server/db/schema';
import { createCustomExercise, listSetsBetween, logSet } from '$lib/server/exercises';
import { U1_SALSA } from '$lib/server/test-walls';

const set = (exerciseId: number, doneAt: number) => ({
	exerciseId,
	doneAt,
	durationS: null,
	reps: null,
	rating: 3,
	note: null,
	playerJson: null
});

describe.runIf(process.env.DEVICE_SQLITE === '1')('the SQLite WASM shim', () => {
	it('drizzle round-trips through the shim', () => {
		const db = openDb(':memory:');
		// The shim's own field: proves the alias took, not better-sqlite3.
		expect((db as unknown as { $client: { _db: unknown } }).$client._db).toBeDefined();
		const ex = createCustomExercise(db, U1_SALSA, { name: 'x', everyDays: 1, notes: null });
		logSet(db, set(ex.id, 1000));
		expect(listSetsBetween(db, 0, Date.now() + 1, U1_SALSA)).toHaveLength(1);
	});

	it('a throwing transaction rolls back', () => {
		const db = openDb(':memory:');
		expect(() =>
			db.transaction((tx) => {
				tx.insert(exercises)
					.values({ name: 'y', source: 'custom', userId: 'u1', dance: 'salsa' })
					.run();
				throw new Error('boom');
			})
		).toThrow('boom');
		expect(db.select().from(exercises).all()).toHaveLength(0);
	});

	it('nested transactions are savepoints', () => {
		const db = openDb(':memory:');
		db.transaction((tx) => {
			tx.insert(exercises)
				.values({ name: 'outer', source: 'custom', userId: 'u1', dance: 'salsa' })
				.run();
			try {
				tx.transaction((inner) => {
					inner
						.insert(exercises)
						.values({ name: 'inner', source: 'custom', userId: 'u1', dance: 'salsa' })
						.run();
					throw new Error('inner');
				});
			} catch {
				/* the inner one only */
			}
		});
		expect(
			db
				.select()
				.from(exercises)
				.all()
				.map((e) => e.name)
		).toEqual(['outer']);
	});
});
