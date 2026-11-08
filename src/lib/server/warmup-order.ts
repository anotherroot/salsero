import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from './db';
import { exercises } from './db/schema';
import { ownedBy, type Wall } from './scope';

/**
 * The person's own order of their warm-ups. `ids` are the warm-ups the card
 * showed, in the order dropped: they get 1..n, and the wall's other live
 * warm-ups (not due today, paused…) follow at n+1.. in their current order
 * (`warmup_order`, unplaced last, then id), so no two collide and nothing
 * hidden jumps ahead. False, with nothing written, when `ids` is empty, repeats
 * an id, or holds anything that is not this wall's own live warm-up.
 */
export function setWarmupOrder(db: Db, wall: Wall, ids: number[]): boolean {
	if (ids.length === 0 || new Set(ids).size !== ids.length) return false;
	return db.transaction((tx) => {
		const live = tx
			.select({ id: exercises.id })
			.from(exercises)
			.where(
				and(ownedBy(exercises, wall), eq(exercises.warmup, true), isNull(exercises.archivedAt))
			)
			.orderBy(sql`${exercises.warmupOrder} is null`, asc(exercises.warmupOrder), asc(exercises.id))
			.all()
			.map((r) => r.id);
		const own = new Set(live);
		if (!ids.every((id) => own.has(id))) return false;
		const posted = new Set(ids);
		const all = [...ids, ...live.filter((id) => !posted.has(id))];
		all.forEach((id, i) =>
			tx
				.update(exercises)
				.set({ warmupOrder: i + 1 })
				.where(eq(exercises.id, id))
				.run()
		);
		return true;
	});
}
