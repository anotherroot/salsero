/** Walls for specs only: two people, and the first one's two dances. */
import { sql } from 'drizzle-orm';
import { openDb, type Db } from './db';
import type { Wall } from './scope';

export const U1_SALSA: Wall = { userId: 'u1', dance: 'salsa' };
export const U1_BACHATA: Wall = { userId: 'u1', dance: 'bachata' };
export const U2_SALSA: Wall = { userId: 'u2', dance: 'salsa' };

/**
 * An in-memory database where a lesson, routine, exercise or song inserted
 * without an owner is given to `u1`. Specs of areas still on the dance wall
 * (their create paths do not set `userId` yet) use it so the figures they
 * read — which are per person — still match. Each area task drops it from
 * its specs when its own create paths set the owner.
 */
export function openOwnedDb(): Db {
	const db = openDb(':memory:');
	for (const table of ['lessons', 'routines', 'exercises', 'songs']) {
		// Custom exercises are made with an owner now (`createCustomExercise`); only the
		// ones lessons and routines make still arrive without.
		const when = table === 'exercises' ? " AND NEW.source <> 'custom'" : '';
		db.run(
			sql.raw(
				`CREATE TRIGGER ${table}_owned AFTER INSERT ON ${table} WHEN NEW.user_id IS NULL${when} BEGIN UPDATE ${table} SET user_id = 'u1' WHERE id = NEW.id; END`
			)
		);
	}
	return db;
}
