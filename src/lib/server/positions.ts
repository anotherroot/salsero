import { and, asc, eq, isNull, ne } from 'drizzle-orm';
import type { Db } from './db';
import { positions } from './db/schema';
import { DANCE_SLUGS, DANCES, type DanceSlug } from '$lib/dances/dances';

export interface PositionInput {
	slug: string;
	name: string;
	neutral: boolean;
	sortOrder: number;
}

/** Unarchived positions of one dance, in the order the pickers show them. */
export function listPositions(db: Db, dance: DanceSlug) {
	return db
		.select()
		.from(positions)
		.where(and(eq(positions.dance, dance), isNull(positions.archivedAt)))
		.orderBy(asc(positions.sortOrder), asc(positions.name))
		.all();
}

/**
 * The dance's neutral position — what an untagged figure is assumed to start
 * and end at. Null only before the seed has run, which no route can observe:
 * `bootstrap` seeds before the first request resolves, and `createPosition`,
 * `updatePosition` and `archivePosition` all refuse to leave a seeded dance
 * without one.
 */
export function neutralPosition(db: Db, dance: DanceSlug) {
	return (
		db
			.select()
			.from(positions)
			.where(and(eq(positions.dance, dance), eq(positions.neutral, true)))
			.get() ?? null
	);
}

/**
 * Add a position. Returns null when the slug is already taken within the dance
 * — the unique index is per `(dance, slug)`, so the same slug in the other
 * dance is a different position and is allowed.
 */
export function createPosition(db: Db, dance: DanceSlug, input: PositionInput) {
	return db.transaction((tx) => {
		const clash = tx
			.select({ id: positions.id })
			.from(positions)
			.where(and(eq(positions.dance, dance), eq(positions.slug, input.slug)))
			.get();
		if (clash) return null;
		const row = tx
			.insert(positions)
			.values({ ...input, dance })
			.returning()
			.get();
		// Exactly one neutral per dance. Written inline rather than through a
		// helper: drizzle's transaction handle is not a `Db`, and nothing else in
		// this repo passes a `tx` to a function.
		if (row.neutral) {
			tx.update(positions)
				.set({ neutral: false })
				.where(and(eq(positions.dance, dance), ne(positions.id, row.id)))
				.run();
		}
		return row;
	});
}

/**
 * Edit a position. Returns null when it is gone, when the new slug clashes, or
 * when the edit would demote the dance's LAST neutral — which would leave the
 * dance with none, and an untagged figure with nothing to resolve to. Promote
 * another position first; that demotes this one as a side effect.
 */
export function updatePosition(db: Db, id: number, input: PositionInput) {
	return db.transaction((tx) => {
		const current = tx.select().from(positions).where(eq(positions.id, id)).get();
		if (!current) return null;
		// Demoting the neutral is only ever safe as a side effect of promoting a
		// different one. Refusing here is what keeps "exactly one per dance" true
		// in both directions — the demotion block below only ever enforces the
		// "at most one" half.
		if (current.neutral && !input.neutral) return null;
		const clash = tx
			.select({ id: positions.id })
			.from(positions)
			.where(and(eq(positions.dance, current.dance), eq(positions.slug, input.slug)))
			.get();
		if (clash && clash.id !== id) return null;
		const row = tx.update(positions).set(input).where(eq(positions.id, id)).returning().get();
		if (row.neutral) {
			tx.update(positions)
				.set({ neutral: false })
				.where(and(eq(positions.dance, current.dance), ne(positions.id, row.id)))
				.run();
		}
		return row;
	});
}

/**
 * Archive a position. The figures tagged with it keep their tags, so an
 * archived position still reads correctly in history — it just stops being
 * offered. Refuses the neutral one: removing it would silently move every
 * untagged figure.
 */
export function archivePosition(db: Db, id: number, now: number): boolean {
	const row = db.select().from(positions).where(eq(positions.id, id)).get();
	if (!row || row.archivedAt !== null || row.neutral) return false;
	db.update(positions).set({ archivedAt: now }).where(eq(positions.id, id)).run();
	return true;
}

/**
 * Seed each dance's vocabulary if it has none, at boot, idempotently — the same
 * reasoning as `seedAdmin`: a deploy that has to remember a seed step forgets.
 *
 * Per dance, not globally: adding a dance to the registry later seeds only the
 * new one and never touches an edited vocabulary.
 */
export function seedPositions(db: Db) {
	for (const dance of DANCE_SLUGS) {
		const existing = db
			.select({ id: positions.id })
			.from(positions)
			.where(eq(positions.dance, dance))
			.limit(1)
			.get();
		if (existing) continue;
		db.insert(positions)
			.values(
				DANCES[dance].seedPositions.map((p, i) => ({
					dance,
					slug: p.slug,
					name: p.name,
					// The registry's first entry is the neutral one.
					neutral: i === 0,
					sortOrder: i
				}))
			)
			.run();
	}
}
